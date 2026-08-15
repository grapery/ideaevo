package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service/billing"
	"gorm.io/gorm"
)

// 订单相关错误
var (
	ErrOrderNotFound      = errors.New("order not found")
	ErrInvalidPlan        = errors.New("invalid plan")
	ErrInvalidCurrency    = errors.New("invalid currency")
	ErrUnsupportedGateway = errors.New("unsupported payment gateway")
	ErrOrderAlreadyPaid   = errors.New("order already paid")
	ErrOrderExpired       = errors.New("order expired")
)

// OrderService 管理订单生命周期：下单 → 网关支付 → 回调激活会员。
type OrderService struct {
	db       *gorm.DB
	gateways map[model.PaymentGateway]PaymentGateway
	mockGW   PaymentGateway
	subSvc   *SubscriptionService
}

func NewOrderService(db *gorm.DB, subSvc *SubscriptionService) *OrderService {
	return &OrderService{
		db:       db,
		gateways: map[model.PaymentGateway]PaymentGateway{},
		mockGW:   &mockGateway{frontendURL: ""},
		subSvc:   subSvc,
	}
}

// RegisterGateway 注册一个支付网关实现。
func (s *OrderService) RegisterGateway(gw PaymentGateway) {
	s.gateways[gw.Name()] = gw
	if mock, ok := gw.(*mockGateway); ok {
		s.mockGW = mock
	}
}

// SetFrontendURL 注入前端地址（mock 网关跳转用）。
func (s *OrderService) SetFrontendURL(url string) {
	s.mockGW = &mockGateway{frontendURL: url}
}

// CreateOrderInput 创建订单入参。
type CreateOrderInput struct {
	UserID   string
	PlanID   string
	Currency string // CNY | USD
	Gateway  model.PaymentGateway
}

// CreateOrderResult 创建订单后的返回。
type CreateOrderResult struct {
	Order      model.Order `json:"order"`
	PaymentURL string      `json:"payment_url"` // 拉起支付的地址（网页/二维码/mock）
	Gateway    string      `json:"gateway"`     // 实际使用的网关（可能是 mock 降级）
}

// CreateOrder 创建订单并向网关下单。
//
// 网关选择逻辑：
//  1. 优先用 input 指定的网关（若已配置凭证）；
//  2. 否则按币种自动选择：CNY → 支付宝/微信（已配置者优先），USD → Stripe；
//  3. 所选网关若未配置凭证 → 降级到 mockGateway，保证链路可联调。
func (s *OrderService) CreateOrder(input CreateOrderInput) (*CreateOrderResult, error) {
	plan, ok := billing.GetPlan(input.PlanID)
	if !ok {
		return nil, ErrInvalidPlan
	}
	if !billing.IsSupportedCurrency(input.Currency) {
		return nil, ErrInvalidCurrency
	}
	price, ok := plan.Prices[input.Currency]
	if !ok {
		return nil, ErrInvalidCurrency
	}

	gateway := s.selectGateway(input.Gateway, input.Currency)
	gw := s.gatewayByName(gateway)

	now := time.Now()
	order := &model.Order{
		UserID:    input.UserID,
		PlanID:    plan.ID,
		Amount:    price,
		Currency:  input.Currency,
		Status:    model.OrderPending,
		Gateway:   gateway,
		ExpiresAt: now.Add(30 * time.Minute),
	}
	if err := s.db.Create(order).Error; err != nil {
		return nil, fmt.Errorf("create order: %w", err)
	}

	// 向网关下单
	gwResult, err := gw.CreatePayment(CreatePaymentInput{
		Order:     order,
		Title:     plan.Name,
		ReturnURL: s.returnURL(),
	})
	if err != nil {
		return nil, fmt.Errorf("gateway create payment: %w", err)
	}

	// 回填网关订单号与支付地址
	if err := s.db.Model(order).Updates(map[string]any{
		"gateway_order_id": gwResult.GatewayOrderID,
		"payment_url":      gwResult.PaymentURL,
	}).Error; err != nil {
		return nil, fmt.Errorf("update order gateway info: %w", err)
	}
	order.GatewayOrderID = gwResult.GatewayOrderID
	order.PaymentURL = gwResult.PaymentURL

	return &CreateOrderResult{
		Order:      *order,
		PaymentURL: gwResult.PaymentURL,
		Gateway:    string(gateway),
	}, nil
}

// selectGateway 按用户指定 + 币种选择网关，凭证不全则降级 mock。
func (s *OrderService) selectGateway(requested model.PaymentGateway, currency string) model.PaymentGateway {
	// 用户指定且已配置 → 用指定
	if requested != "" {
		if gw, ok := s.gateways[requested]; ok && gw.Enabled() {
			return requested
		}
	}
	// 按币种自动选
	if currency == "USD" {
		if gw, ok := s.gateways[model.GatewayStripe]; ok && gw.Enabled() {
			return model.GatewayStripe
		}
	}
	if currency == "CNY" {
		// 优先支付宝，其次微信
		for _, name := range []model.PaymentGateway{model.GatewayAlipay, model.GatewayWeChat} {
			if gw, ok := s.gateways[name]; ok && gw.Enabled() {
				return name
			}
		}
	}
	return "mock"
}

func (s *OrderService) gatewayByName(name model.PaymentGateway) PaymentGateway {
	if gw, ok := s.gateways[name]; ok && gw.Enabled() {
		return gw
	}
	return s.mockGW
}

func (s *OrderService) returnURL() string {
	if m, ok := s.mockGW.(*mockGateway); ok {
		return m.frontendURL + "/billing"
	}
	return ""
}

// GetOrder 按 ID 查订单。
func (s *OrderService) GetOrder(orderID, userID string) (*model.Order, error) {
	var order model.Order
	q := s.db.Where("id = ?", orderID)
	if userID != "" {
		q = q.Where("user_id = ?", userID)
	}
	if err := q.First(&order).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOrderNotFound
		}
		return nil, err
	}
	return &order, nil
}

// ListOrders 列出用户订单（最近优先）。
func (s *OrderService) ListOrders(userID string, limit, offset int) ([]model.Order, int64, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	var orders []model.Order
	var total int64
	s.db.Model(&model.Order{}).Where("user_id = ?", userID).Count(&total)
	if err := s.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&orders).Error; err != nil {
		return nil, 0, err
	}
	return orders, total, nil
}

// MarkPaid 标记订单已支付并激活会员。幂等：已支付订单重复调用直接成功。
//
// 这是 webhook 回调（真实网关）与 mock 激活接口的共同落点。
// 用事务保证「订单状态更新 + 会员激活」原子完成。
func (s *OrderService) MarkPaid(orderID, gatewayOrderID string) error {
	var order model.Order
	if err := s.db.First(&order, "id = ?", orderID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrOrderNotFound
		}
		return err
	}

	// 幂等：已支付直接返回成功
	if order.Status == model.OrderPaid {
		return nil
	}
	if order.Status == model.OrderFailed {
		return ErrOrderExpired
	}

	// 校验网关订单号匹配（防伪造 webhook 激活他人订单）
	if gatewayOrderID != "" && order.GatewayOrderID != "" && gatewayOrderID != order.GatewayOrderID {
		return fmt.Errorf("gateway order id mismatch")
	}

	now := time.Now()
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&order).Updates(map[string]any{
			"status":          model.OrderPaid,
			"paid_at":         &now,
			"gateway_order_id": gatewayOrderID,
		}).Error; err != nil {
			return err
		}
		order.Status = model.OrderPaid
		order.PaidAt = &now
		// 激活会员（续期）—— 纳入同一事务
		return s.subSvc.activateOrderWithTx(tx, &order)
	})
}

// CancelOrder 用户主动取消未支付订单。
func (s *OrderService) CancelOrder(orderID, userID string) error {
	result := s.db.Model(&model.Order{}).
		Where("id = ? AND user_id = ? AND status = ?", orderID, userID, model.OrderPending).
		Update("status", model.OrderFailed)
	if result.RowsAffected == 0 {
		return ErrOrderNotFound
	}
	return result.Error
}
