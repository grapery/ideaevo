package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ---- 订阅套餐等级 ----

type PlanTier string

const (
	PlanFree PlanTier = "free" // 免费用户：每日 1W token，不能创建 Agent，不能用 MCP
	PlanPro  PlanTier = "pro"  // 付费用户：每日 1000W token，可创建 10 个 Agent，可用 MCP
)

// ---- 订单状态机 ----
//
// pending  → 已下单，等待用户支付
// paid     → 支付成功，已激活会员
// failed   → 用户取消 / 订单超时未支付
// refunded → 已退款

type OrderStatus string

const (
	OrderPending  OrderStatus = "pending"
	OrderPaid     OrderStatus = "paid"
	OrderFailed   OrderStatus = "failed"
	OrderRefunded OrderStatus = "refunded"
)

// 支付网关
type PaymentGateway string

const (
	GatewayAlipay PaymentGateway = "alipay"
	GatewayWeChat PaymentGateway = "wechat"
	GatewayStripe PaymentGateway = "stripe"
)

// Order 充值订单。
//
// 金额一律用「最小货币单位的整数」存储（分 / cent），杜绝浮点误差：
//   - CNY: 1990 = ¥19.90
//   - USD:  990 = $9.90
//
// GatewayOrderID 加唯一索引，防止 webhook 重复激活同一笔外部订单。
type Order struct {
	ID             string         `gorm:"primaryKey;size:36" json:"id"`
	UserID         string         `gorm:"size:36;index" json:"user_id"`
	PlanID         string         `gorm:"size:64;not null" json:"plan_id"` // 固定套餐标识，如 pro_monthly
	Amount         int            `gorm:"not null" json:"amount"`          // 最小货币单位整数
	Currency       string         `gorm:"size:8;not null" json:"currency"` // CNY | USD
	Status         OrderStatus    `gorm:"size:16;index;default:'pending'" json:"status"`
	Gateway        PaymentGateway `gorm:"size:16" json:"gateway"`
	GatewayOrderID string         `gorm:"size:128;uniqueIndex" json:"gateway_order_id,omitempty"` // 网关侧订单号 / PaymentIntent ID
	PaymentURL     string         `gorm:"size:1024" json:"payment_url,omitempty"`                 // 跳转支付页 / 二维码内容
	PaidAt         *time.Time     `json:"paid_at,omitempty"`
	ExpiresAt      time.Time      `gorm:"not null" json:"expires_at"` // 订单自身过期时间（未支付 30 分钟失效）
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

func (o *Order) BeforeCreate(tx *gorm.DB) error {
	if o.ID == "" {
		o.ID = uuid.New().String()
	}
	return nil
}

// DailyQuota 每日 token 用量。
//
// 「每日重置」语义 = 新的一天（用户本地时区）新建一行；旧行不再写入。
// Date 用字符串 "2006-01-02" 而非 time.Time，避免 MySQL 时区坑。
// TokensLimit 存当日额度快照：用户当日升级/降级不影响当日记录，次日按新等级发。
type DailyQuota struct {
	ID          string     `gorm:"primaryKey;size:36" json:"id"`
	UserID      string     `gorm:"size:36;uniqueIndex:idx_quota_user_date,priority:1" json:"user_id"`
	Date        string     `gorm:"size:10;uniqueIndex:idx_quota_user_date,priority:2" json:"date"` // YYYY-MM-DD（本地时区）
	TokensUsed  int        `gorm:"default:0" json:"tokens_used"`
	TokensLimit int        `gorm:"not null" json:"tokens_limit"` // 当日额度上限快照
	LastChatAt  *time.Time `json:"last_chat_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

func (q *DailyQuota) BeforeCreate(tx *gorm.DB) error {
	if q.ID == "" {
		q.ID = uuid.New().String()
	}
	return nil
}

// Remaining 返回当日剩余 token（不会小于 0）。
func (q *DailyQuota) Remaining() int {
	r := q.TokensLimit - q.TokensUsed
	if r < 0 {
		return 0
	}
	return r
}

// ---- 退款审批状态机 ----
//
// pending  → 用户已提交退款申请，待管理员审批
// approved → 管理员批准，已撤销对应订单赋予的会员续期，订单标记 refunded
// rejected → 管理员拒绝，会员状态不变

type RefundStatus string

const (
	RefundPending  RefundStatus = "pending"
	RefundApproved RefundStatus = "approved"
	RefundRejected RefundStatus = "rejected"
)

// Refund 退款申请记录。
//
// 与 Order 解耦：退款是独立审批流程，一张已支付订单只能有一条 pending 退款申请
// （唯一索引 order_id + status 限制，配合业务校验防重复申请）。
// 审批通过时，按订单赋予的 Duration 反向扣减用户 PlanExpiresAt，并把订单置为 refunded。
type Refund struct {
	ID         string       `gorm:"primaryKey;size:36" json:"id"`
	OrderID    string       `gorm:"size:36;index" json:"order_id"`
	UserID     string       `gorm:"size:36;index" json:"user_id"`
	Amount     int          `gorm:"not null" json:"amount"` // 退款金额（同订单最小货币单位）
	Currency   string       `gorm:"size:8;not null" json:"currency"`
	Reason     string       `gorm:"size:500" json:"reason"` // 用户填写的退款原因
	Status     RefundStatus `gorm:"size:16;index;default:'pending'" json:"status"`
	AdminNote  string       `gorm:"size:500" json:"admin_note,omitempty"` // 管理员审批备注
	ReviewedBy string       `gorm:"size:36" json:"reviewed_by,omitempty"` // 审批管理员 ID
	ReviewedAt *time.Time   `json:"reviewed_at,omitempty"`
	CreatedAt  time.Time    `json:"created_at"`
	UpdatedAt  time.Time    `json:"updated_at"`
}

func (r *Refund) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	return nil
}
