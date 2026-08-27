package handler

import (
	"errors"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service"
	"github.com/wanye/ideaevo/internal/service/billing"
)

// BillingHandler 充值/会员/退款相关的 REST API。
//
// 路由设计（在 main.go 注册）：
//
//	GET    /api/billing/plans                 套餐与价格（公开）
//	GET    /api/billing/membership            当前用户会员状态 + 今日额度（需登录）
//	POST   /api/billing/orders                创建充值订单（需登录）
//	GET    /api/billing/orders                订单列表（需登录）
//	GET    /api/billing/orders/:id            订单详情（需登录）
//	POST   /api/billing/orders/:id/cancel     取消未支付订单（需登录）
//	POST   /api/billing/orders/:id/mock-pay   模拟支付激活（仅 mock 网关，需登录）
//	POST   /api/billing/orders/:id/refund     申请退款（需登录）
//	GET    /api/billing/refunds               我的退款申请列表（需登录）
//	GET    /api/admin/refunds                 待审批退款列表（管理员）
//	POST   /api/admin/refunds/:id/approve     批准退款（管理员）
//	POST   /api/admin/refunds/:id/reject      拒绝退款（管理员）
//	POST   /api/billing/webhooks/:gateway     支付网关异步回调（公开，签名校验）
type BillingHandler struct {
	orderSvc   *service.OrderService
	subSvc     *service.SubscriptionService
	refundSvc  *service.RefundService
	webhooks   *service.WebhookVerifier
}

func NewBillingHandler(orderSvc *service.OrderService, subSvc *service.SubscriptionService, refundSvc *service.RefundService, webhooks *service.WebhookVerifier) *BillingHandler {
	return &BillingHandler{orderSvc: orderSvc, subSvc: subSvc, refundSvc: refundSvc, webhooks: webhooks}
}

// Plans 返回所有可购买套餐及价格（公开）。
func (h *BillingHandler) Plans(c *gin.Context) {
	plans := make([]gin.H, 0, len(billing.Plans))
	for _, p := range billing.Plans {
		plans = append(plans, gin.H{
			"id":            p.ID,
			"name":          p.Name,
			"duration_days": int(p.Duration.Hours() / 24),
			"prices":        p.Prices,
			"daily_tokens":  p.DailyTokens,
			"max_agents":    p.MaxAgents,
		})
	}
	// 附带免费额度信息，供前端对比展示
	c.JSON(http.StatusOK, gin.H{
		"plans": plans,
		"free": gin.H{
			"daily_tokens": billing.FreeDailyTokens,
			"max_agents":   billing.FreeMaxAgents,
		},
		"currencies": billing.SupportedCurrencies,
	})
}

// Membership 返回当前用户的会员状态、Agent 上限/已用、今日 token 额度。
// 供充值页与用户主页展示。
func (h *BillingHandler) Membership(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
		return
	}

	tier := h.subSvc.EffectiveTier(userID)
	limit := service.ResolveDailyLimit(tier)
	quota, err := h.subSvc.QuotaService().View(userID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "加载额度失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"is_pro":      tier == model.PlanPro,
		"plan_tier":   string(tier),
		"max_agents":  h.subSvc.MaxAgents(userID),
		"agent_count": h.subSvc.AgentCount(userID),
		"daily_quota": quota,
	})
}

// CreateOrderInput 创建订单入参。
type CreateOrderInput struct {
	PlanID   string `json:"plan_id" binding:"required"`
	Currency string `json:"currency" binding:"required"` // CNY | USD
	Gateway  string `json:"gateway"`                     // alipay | wechat | stripe（可选，自动选择）
}

// CreateOrder 创建充值订单并返回支付地址。
func (h *BillingHandler) CreateOrder(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
		return
	}

	var input CreateOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.orderSvc.CreateOrder(service.CreateOrderInput{
		UserID:   userID,
		PlanID:   input.PlanID,
		Currency: input.Currency,
		Gateway:  model.PaymentGateway(input.Gateway),
	})
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, service.ErrInvalidPlan):
			status = http.StatusBadRequest
		case errors.Is(err, service.ErrInvalidCurrency):
			status = http.StatusBadRequest
		default:
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, result)
}

// ListOrders 当前用户订单列表。
func (h *BillingHandler) ListOrders(c *gin.Context) {
	userID := c.GetString("user_id")
	limit, ok := intQuery(c, "limit", 20)
	if !ok {
		return
	}
	offset, ok := intQuery(c, "offset", 0)
	if !ok {
		return
	}

	orders, total, err := h.orderSvc.ListOrders(userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"orders": orders, "total": total})
}

// GetOrder 订单详情。
func (h *BillingHandler) GetOrder(c *gin.Context) {
	userID := c.GetString("user_id")
	order, err := h.orderSvc.GetOrder(c.Param("id"), userID)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, service.ErrOrderNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, order)
}

// CancelOrder 取消未支付订单。
func (h *BillingHandler) CancelOrder(c *gin.Context) {
	userID := c.GetString("user_id")
	if err := h.orderSvc.CancelOrder(c.Param("id"), userID); err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, service.ErrOrderNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已取消"})
}

// MockPay 模拟支付成功（仅 mock 网关降级时使用）。
// 真实环境由各网关 webhook 调用 MarkPaid 完成激活。
func (h *BillingHandler) MockPay(c *gin.Context) {
	userID := c.GetString("user_id")
	order, err := h.orderSvc.GetOrder(c.Param("id"), userID)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, service.ErrOrderNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	// 仅允许 mock 订单走此接口
	if string(order.Gateway) != "mock" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该订单非模拟支付，请通过支付网关完成"})
		return
	}
	if err := h.orderSvc.MarkPaid(order.ID, ""); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "支付成功，会员已激活"})
}

// Webhook 支付网关异步回调入口。
// 按网关验签（Stripe HMAC-SHA256 / 支付宝 RSA2 / 微信 v3 平台公钥 + AES-GCM），
// 验签失败一律拒绝、绝不触发 MarkPaid；mock 网关回调仅在
// MOCK_PAY_WEBHOOK_ENABLED=true 的联调环境放行。
func (h *BillingHandler) Webhook(c *gin.Context) {
	gateway := model.PaymentGateway(c.Param("gateway"))
	body, _ := io.ReadAll(c.Request.Body)

	var (
		order service.WebhookOrder
		err   error
	)
	switch gateway {
	case model.GatewayStripe:
		order, err = h.webhooks.VerifyStripe(body, c.GetHeader("Stripe-Signature"))
	case model.GatewayAlipay:
		order, err = h.webhooks.VerifyAlipay(body)
	case model.GatewayWeChat:
		order, err = h.webhooks.VerifyWeChat(body,
			c.GetHeader("Wechatpay-Signature"),
			c.GetHeader("Wechatpay-Timestamp"),
			c.GetHeader("Wechatpay-Nonce"))
	case model.PaymentGateway("mock"):
		if !h.webhooks.MockWebhookAllowed() {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "mock webhook disabled"})
			return
		}
		// 联调专用：订单号仅可来自显式声明的 query 参数，且仅对 mock 订单生效
		orderID := c.Query("order")
		if orderID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot resolve order id"})
			return
		}
		order = service.WebhookOrder{OrderID: orderID}
	default:
		c.JSON(http.StatusNotFound, gin.H{"error": "unknown gateway"})
		return
	}

	if err != nil {
		switch {
		case errors.Is(err, service.ErrWebhookNotPaid):
			// 非成功状态：按网关期望应答以停止重推，但不入账
			ackWebhook(c, gateway)
		case errors.Is(err, service.ErrWebhookNotConfigured):
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "webhook verification not configured"})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "webhook verification failed"})
		}
		return
	}

	if err := h.orderSvc.MarkPaid(order.OrderID, order.GatewayOrderID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ackWebhook(c, gateway)
}

// ackWebhook 按网关期望格式应答成功：
// 支付宝要求纯文本 "success"，微信要求 200 + code:SUCCESS，Stripe 200 JSON 即可。
func ackWebhook(c *gin.Context, gateway model.PaymentGateway) {
	switch gateway {
	case model.GatewayAlipay:
		c.String(http.StatusOK, "success")
	case model.GatewayWeChat:
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
	default:
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	}
}

// ---- 退款申请（用户侧）----

// RequestRefundInput 申请退款入参。
type RequestRefundInput struct {
	Reason string `json:"reason"`
}

// RequestRefund 用户对已支付订单提交退款申请（进入待审批）。
func (h *BillingHandler) RequestRefund(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
		return
	}
	var input RequestRefundInput
	_ = c.ShouldBindJSON(&input) // reason 可空，绑定失败不阻断

	refund, err := h.refundSvc.RequestRefund(userID, c.Param("id"), input.Reason)
	if err != nil {
		status := http.StatusInternalServerError
		switch {
		case errors.Is(err, service.ErrOrderNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrOrderNotRefundable):
			status = http.StatusBadRequest
		case errors.Is(err, service.ErrRefundAlreadyExists), errors.Is(err, service.ErrRefundAlreadyClosed):
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, refund)
}

// ListMyRefunds 当前用户的退款申请列表。
func (h *BillingHandler) ListMyRefunds(c *gin.Context) {
	userID := c.GetString("user_id")
	limit, ok := intQuery(c, "limit", 20)
	if !ok {
		return
	}
	offset, ok := intQuery(c, "offset", 0)
	if !ok {
		return
	}

	refunds, total, err := h.refundSvc.ListUserRefunds(userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"refunds": refunds, "total": total})
}

// ---- 退款审批（管理员侧）----

// ListPendingRefunds 列出待审批退款（管理员后台）。
func (h *BillingHandler) ListPendingRefunds(c *gin.Context) {
	limit, ok := intQuery(c, "limit", 20)
	if !ok {
		return
	}
	offset, ok := intQuery(c, "offset", 0)
	if !ok {
		return
	}

	refunds, total, err := h.refundSvc.ListPendingRefunds(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"refunds": refunds, "total": total})
}

// ReviewRefundInput 审批入参。
type ReviewRefundInput struct {
	Note string `json:"note"`
}

// ApproveRefund 管理员批准退款：撤销会员续期 + 订单置 refunded。
func (h *BillingHandler) ApproveRefund(c *gin.Context) {
	adminID := c.GetString("user_id")
	var input ReviewRefundInput
	_ = c.ShouldBindJSON(&input)

	if err := h.refundSvc.Approve(c.Param("id"), adminID, input.Note); err != nil {
		status := http.StatusInternalServerError
		switch {
		case errors.Is(err, service.ErrRefundNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrRefundAlreadyClosed):
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已批准退款，会员已撤销"})
}

// RejectRefund 管理员拒绝退款：会员状态不变。
func (h *BillingHandler) RejectRefund(c *gin.Context) {
	adminID := c.GetString("user_id")
	var input ReviewRefundInput
	_ = c.ShouldBindJSON(&input)

	if err := h.refundSvc.Reject(c.Param("id"), adminID, input.Note); err != nil {
		status := http.StatusInternalServerError
		switch {
		case errors.Is(err, service.ErrRefundNotFound):
			status = http.StatusNotFound
		case errors.Is(err, service.ErrRefundAlreadyClosed):
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "已拒绝退款"})
}
