package service

import (
	"fmt"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service/billing"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// QuotaService 管理用户每日 token 额度的查询与扣减。
//
// 「每日重置」实现：按 user_id + 本地日期取当日记录；新的一天自动新建一行，
// 旧行不再写入。额度上限在创建当日记录时按用户当前会员等级快照，
// 当日内升级/降级不影响当日记录，次日按新等级发放。
type QuotaService struct {
	db *gorm.DB
}

func NewQuotaService(db *gorm.DB) *QuotaService {
	return &QuotaService{db: db}
}

// QuotaView 是对外暴露的额度视图（用于 API 响应 / 主页展示）。
type QuotaView struct {
	Date        string `json:"date"`
	TokensUsed  int    `json:"tokens_used"`
	TokensLimit int    `json:"tokens_limit"`
	TokensLeft  int    `json:"tokens_left"`
}

// GetOrInitToday 获取（或创建）用户今日的额度记录。
// limit 按调用方传入的当日额度上限快照写入（由 SubscriptionService 解析会员等级得出）。
func (s *QuotaService) GetOrInitToday(userID string, todayLimit int) (*model.DailyQuota, error) {
	date := todayString()

	var q model.DailyQuota
	err := s.db.Where("user_id = ? AND date = ?", userID, date).First(&q).Error
	if err == nil {
		return &q, nil
	}
	if !isRecordNotFound(err) {
		return nil, fmt.Errorf("query daily quota: %w", err)
	}

	// 并发安全：用 ON DUPLICATE / clause.OnConflict 兜底，避免并发首消息竞争建两行。
	q = model.DailyQuota{
		UserID:      userID,
		Date:        date,
		TokensUsed:  0,
		TokensLimit: todayLimit,
	}
	if err := s.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "date"}},
		DoNothing: true,
	}).Create(&q).Error; err != nil {
		return nil, fmt.Errorf("create daily quota: %w", err)
	}

	// OnConflict DoNothing 时 RowsAffected=0 也不代表失败（可能是已有行）。
	// 重新查询拿权威记录。
	if err := s.db.Where("user_id = ? AND date = ?", userID, date).First(&q).Error; err != nil {
		return nil, fmt.Errorf("reload daily quota: %w", err)
	}
	return &q, nil
}

// View 返回用户今日额度视图（前端展示用）。
func (s *QuotaService) View(userID string, todayLimit int) (QuotaView, error) {
	q, err := s.GetOrInitToday(userID, todayLimit)
	if err != nil {
		return QuotaView{}, err
	}
	return QuotaView{
		Date:        q.Date,
		TokensUsed:  q.TokensUsed,
		TokensLimit: q.TokensLimit,
		TokensLeft:  q.Remaining(),
	}, nil
}

// Deduct 扣减 token 用量（LLM 返回真实 token 数后调用）。
// 采用原子 UPDATE ... SET tokens_used = tokens_used + n，避免并发消息导致超扣。
// 超额不报错（LLM 已经消耗了），仅记录实际用量。
func (s *QuotaService) Deduct(userID string, tokens int) {
	if tokens <= 0 {
		return
	}
	now := time.Now()
	s.db.Model(&model.DailyQuota{}).
		Where("user_id = ? AND date = ?", userID, todayString()).
		Updates(map[string]any{
			"tokens_used": gorm.Expr("tokens_used + ?", tokens),
			"last_chat_at": &now,
		})
}

// todayString 返回本地时区的当日 "2006-01-02"。
func todayString() string {
	return time.Now().Format("2006-01-02")
}

func isRecordNotFound(err error) bool {
	return err == gorm.ErrRecordNotFound
}

// ResolveDailyLimit 按会员等级返回当日额度上限。
// 供 SubscriptionService / ChatService / BillingHandler 共用。
func ResolveDailyLimit(tier model.PlanTier) int {
	if tier == model.PlanPro {
		return billing.ProDailyTokens
	}
	return billing.FreeDailyTokens
}
