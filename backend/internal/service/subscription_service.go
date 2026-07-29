package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service/billing"
	"gorm.io/gorm"
)

// 计费模块的错误语义。handler 据此返回合适的 HTTP 状态码。
var (
	// ErrSubscriptionRequired 需要付费会员（402 Payment Required）。
	ErrSubscriptionRequired = errors.New("subscription required")
	// ErrAgentLimitReached 已达 Agent 创建上限（403 Forbidden）。
	ErrAgentLimitReached = errors.New("agent limit reached")
	// ErrQuotaExceeded 今日 token 额度用尽（429 Too Many Requests）。
	ErrQuotaExceeded = errors.New("daily token quota exceeded")
)

// SubscriptionService 判断用户会员状态与功能权限。
//
// 会员有效性规则：PlanTier == pro 且 PlanExpiresAt > now。
// 过期后「软降级」——不修改数据库，只在判断时视为 free，保留历史订阅记录。
type SubscriptionService struct {
	db        *gorm.DB
	quotaSvc  *QuotaService
	agentSvc  *AgentService
}

func NewSubscriptionService(db *gorm.DB, quotaSvc *QuotaService, agentSvc *AgentService) *SubscriptionService {
	return &SubscriptionService{db: db, quotaSvc: quotaSvc, agentSvc: agentSvc}
}

// IsPro 判断用户当前是否为有效付费会员。
// admin 永远视为 pro（内部账号特权）。
func (s *SubscriptionService) IsPro(userID string) bool {
	var user model.User
	if err := s.db.Select("plan_tier, plan_expires_at, role").
		First(&user, "id = ?", userID).Error; err != nil {
		return false
	}
	if user.Role == model.RoleAdmin {
		return true
	}
	return effectiveTier(&user) == model.PlanPro
}

// effectiveTier 根据数据库字段计算「实际生效」的等级（过期视为 free）。
func effectiveTier(u *model.User) model.PlanTier {
	if u.PlanTier != model.PlanPro {
		return model.PlanFree
	}
	if u.PlanExpiresAt == nil || u.PlanExpiresAt.Before(time.Now()) {
		return model.PlanFree
	}
	return model.PlanPro
}

// EffectiveTier 返回用户生效等级（过期降级为 free）。
func (s *SubscriptionService) EffectiveTier(userID string) model.PlanTier {
	var user model.User
	if err := s.db.Select("plan_tier, plan_expires_at, role").
		First(&user, "id = ?", userID).Error; err != nil {
		return model.PlanFree
	}
	if user.Role == model.RoleAdmin {
		return model.PlanPro
	}
	return effectiveTier(&user)
}

// MaxAgents 返回用户可创建的 Agent 上限。
func (s *SubscriptionService) MaxAgents(userID string) int {
	if s.IsPro(userID) {
		return billing.ProMaxAgents
	}
	return billing.FreeMaxAgents
}

// CanCreateAgent 校验用户能否再创建一个 Agent。
// 返回 nil 表示可以；否则返回语义错误（ErrSubscriptionRequired / ErrAgentLimitReached）。
func (s *SubscriptionService) CanCreateAgent(userID string) error {
	if !s.IsPro(userID) {
		return ErrSubscriptionRequired
	}
	_, total, err := s.agentSvc.ListByOwner(userID, 1, 0)
	if err != nil {
		return fmt.Errorf("count agents: %w", err)
	}
	if int(total) >= billing.ProMaxAgents {
		return ErrAgentLimitReached
	}
	return nil
}

// EnsureCanUseMCP 校验用户（通过其 Agent）能否使用 MCP 服务。
// MCP 入口只能拿到 Agent，需通过 agent.OwnerUserID 反查计费归属。
func (s *SubscriptionService) EnsureCanUseMCP(ownerUserID string) error {
	if ownerUserID == "" {
		return ErrSubscriptionRequired
	}
	if !s.IsPro(ownerUserID) {
		return ErrSubscriptionRequired
	}
	return nil
}

// ActivateOrder 激活一笔已支付订单对应的会员。
// 续期语义：若当前仍在有效期内，则在到期时间基础上 +Duration；
// 若已过期或无订阅，则从 now 起 +Duration。
// 使用 s.db，若需纳入外层事务请用 activateOrderWithTx。
func (s *SubscriptionService) ActivateOrder(order *model.Order) error {
	return s.activateOrderWithTx(s.db, order)
}

// activateOrderWithTx 在指定 db（可能是事务）上激活会员，
// 保证「订单状态更新 + 会员激活」在同一事务内原子完成。
func (s *SubscriptionService) activateOrderWithTx(tx *gorm.DB, order *model.Order) error {
	plan, ok := billing.GetPlan(order.PlanID)
	if !ok {
		return fmt.Errorf("unknown plan: %s", order.PlanID)
	}

	now := time.Now()
	var user model.User
	if err := tx.First(&user, "id = ?", order.UserID).Error; err != nil {
		return fmt.Errorf("load user for activation: %w", err)
	}

	// 续期基准：现有到期时间若在未来则累加，否则从现在起算。
	base := now
	if user.PlanExpiresAt != nil && user.PlanExpiresAt.After(now) {
		base = *user.PlanExpiresAt
	}
	newExpiry := base.Add(plan.Duration)

	if err := tx.Model(&user).Updates(map[string]any{
		"plan_tier":       model.PlanPro,
		"plan_expires_at": newExpiry,
	}).Error; err != nil {
		return fmt.Errorf("activate subscription: %w", err)
	}
	return nil
}

// revokeOrderWithTx 退款时反向撤销一笔订单赋予的会员续期。
// 从当前 PlanExpiresAt 减去该订单的 Duration：
//   - 若撤销后到期时间仍在未来：缩短有效期（保留 Pro）；
//   - 若撤销后到期时间已到/为空：会员立即失效（到期时间保留为历史值，
//     effectiveTier 判定时会因过期自动降级为 free）。
func (s *SubscriptionService) revokeOrderWithTx(tx *gorm.DB, order *model.Order) error {
	plan, ok := billing.GetPlan(order.PlanID)
	if !ok {
		return fmt.Errorf("unknown plan: %s", order.PlanID)
	}

	var user model.User
	if err := tx.First(&user, "id = ?", order.UserID).Error; err != nil {
		return fmt.Errorf("load user for revoke: %w", err)
	}

	updates := map[string]any{}
	if user.PlanExpiresAt != nil {
		newExpiry := user.PlanExpiresAt.Add(-plan.Duration)
		// 若撤销后已过期，把到期时间提前到此刻前，使 effectiveTier 判定为 free。
		now := time.Now()
		if newExpiry.After(now) {
			updates["plan_expires_at"] = newExpiry
		} else {
			past := now.Add(-time.Second)
			updates["plan_expires_at"] = &past
		}
	} else {
		// 无到期时间（异常情况），无需调整
		return nil
	}

	if err := tx.Model(&user).Updates(updates).Error; err != nil {
		return fmt.Errorf("revoke subscription: %w", err)
	}
	return nil
}

// QuotaService 返回内部 QuotaService（ChatService 计费复用）。
func (s *SubscriptionService) QuotaService() *QuotaService { return s.quotaSvc }

// AgentCount 返回用户已创建的 Agent 总数（含 private）。
// 供 BillingHandler 在 Membership 视图中展示「已用 / 上限」。
func (s *SubscriptionService) AgentCount(userID string) int64 {
	_, total, err := s.agentSvc.ListByOwner(userID, 1, 0)
	if err != nil {
		return 0
	}
	return total
}

// MembershipView 是对外的会员状态视图（主页 / 充值页展示）。
type MembershipView struct {
	IsPro        bool       `json:"is_pro"`
	PlanTier     string     `json:"plan_tier"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	MaxAgents    int        `json:"max_agents"`
	AgentCount   int64      `json:"agent_count"`
	DailyQuota   QuotaView  `json:"daily_quota"`
}
