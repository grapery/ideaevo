package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ErrInsufficientFlowers is returned when the user has no remaining daily send budget.
var ErrInsufficientFlowers = errors.New("insufficient_flowers")

// ErrFlowerSenderRequired is returned when neither user nor agent owner can be resolved.
var ErrFlowerSenderRequired = errors.New("flower_sender_required")

var flowerDayLocation = func() *time.Location {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return time.FixedZone("CST", 8*3600)
	}
	return loc
}()

func flowerTodayString() string {
	return time.Now().In(flowerDayLocation).Format("2006-01-02")
}

// FlowerBalanceView is the API view for a user's flower budget and received stats.
// GrantQuota is spendable only — never included in received statistics.
type FlowerBalanceView struct {
	Date             string `json:"date"`
	GrantQuota       int    `json:"grant_quota"`
	ReceivedToday    int    `json:"received_today"`
	SpentToday       int    `json:"spent_today"`
	Available        int    `json:"available"`
	LifetimeReceived int    `json:"lifetime_received"`
	LifetimeSent     int    `json:"lifetime_sent"`
}

// resolveSpenderUserID maps the authenticated actor to the login user who owns the daily budget.
// User JWT → that user. Agent API key / MCP → agent.owner_user_id.
func (s *SocialService) resolveSpenderUserID(tx *gorm.DB, userID, agentID string) (string, error) {
	if userID != "" {
		return userID, nil
	}
	if agentID == "" {
		return "", ErrFlowerSenderRequired
	}
	var ownerID string
	if err := tx.Model(&model.Agent{}).Where("id = ?", agentID).Pluck("COALESCE(owner_user_id, '')", &ownerID).Error; err != nil {
		return "", fmt.Errorf("resolve agent owner: %w", err)
	}
	if ownerID == "" {
		return "", ErrFlowerSenderRequired
	}
	return ownerID, nil
}

// resolveIdeaAuthorOwnerID returns the owning login user of the idea's publishing agent.
func (s *SocialService) resolveIdeaAuthorOwnerID(tx *gorm.DB, ideaID string) (string, error) {
	var agentID string
	if err := tx.Model(&model.Idea{}).Where("id = ?", ideaID).Pluck("agent_id", &agentID).Error; err != nil {
		return "", err
	}
	if agentID == "" {
		return "", nil
	}
	var ownerID string
	if err := tx.Model(&model.Agent{}).Where("id = ?", agentID).Pluck("COALESCE(owner_user_id, '')", &ownerID).Error; err != nil {
		return "", err
	}
	return ownerID, nil
}

// ensureFlowerBalanceToday locks (or creates) today's balance row for userID inside tx.
func (s *SocialService) ensureFlowerBalanceToday(tx *gorm.DB, userID string) (*model.FlowerDailyBalance, error) {
	date := flowerTodayString()
	var bal model.FlowerDailyBalance
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("user_id = ? AND date = ?", userID, date).
		First(&bal).Error
	if err == nil {
		return &bal, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	bal = model.FlowerDailyBalance{
		UserID:     userID,
		Date:       date,
		GrantQuota: model.FlowerDailyGrant,
	}
	if err := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "date"}},
		DoNothing: true,
	}).Create(&bal).Error; err != nil {
		return nil, fmt.Errorf("create flower daily balance: %w", err)
	}

	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("user_id = ? AND date = ?", userID, date).
		First(&bal).Error; err != nil {
		return nil, fmt.Errorf("reload flower daily balance: %w", err)
	}
	return &bal, nil
}

func (s *SocialService) spendFlower(tx *gorm.DB, userID string, amount int) (*model.FlowerDailyBalance, error) {
	if amount <= 0 {
		amount = 1
	}
	bal, err := s.ensureFlowerBalanceToday(tx, userID)
	if err != nil {
		return nil, err
	}
	if bal.Available() < amount {
		return bal, ErrInsufficientFlowers
	}
	if err := tx.Model(bal).UpdateColumn("spent_today", gorm.Expr("spent_today + ?", amount)).Error; err != nil {
		return nil, err
	}
	bal.SpentToday += amount
	return bal, nil
}

func (s *SocialService) creditReceivedFlower(tx *gorm.DB, userID string, amount int) error {
	if userID == "" || amount <= 0 {
		return nil
	}
	bal, err := s.ensureFlowerBalanceToday(tx, userID)
	if err != nil {
		return err
	}
	return tx.Model(bal).UpdateColumn("received_today", gorm.Expr("received_today + ?", amount)).Error
}

func (s *SocialService) countLifetimeReceived(userID string) (int64, error) {
	// Only real gifts from others. Self-sends (user or owned agents) are excluded.
	// Daily grant of 99 is never part of this count.
	var n int64
	err := s.db.Raw(`
		SELECT COUNT(*) FROM flowers f
		JOIN ideas i ON i.id = f.idea_id
		JOIN agents author ON author.id = i.agent_id
		LEFT JOIN agents sender_agent ON sender_agent.id = f.agent_id AND f.agent_id <> ''
		WHERE author.owner_user_id = ?
		  AND COALESCE(NULLIF(f.user_id, ''), sender_agent.owner_user_id, '') <> ?
	`, userID, userID).Scan(&n).Error
	return n, err
}

func (s *SocialService) countLifetimeSent(userID string) (int64, error) {
	var agentIDs []string
	if err := s.db.Model(&model.Agent{}).Where("owner_user_id = ?", userID).Pluck("id", &agentIDs).Error; err != nil {
		return 0, err
	}
	q := s.db.Model(&model.Flower{}).Where("user_id = ?", userID)
	if len(agentIDs) > 0 {
		q = s.db.Model(&model.Flower{}).Where("user_id = ? OR agent_id IN ?", userID, agentIDs)
	}
	var n int64
	if err := q.Count(&n).Error; err != nil {
		return 0, err
	}
	return n, nil
}

// GetFlowerBalance returns today's budget and lifetime received/sent stats for a login user.
// lifetime_received never includes the daily grant of 99.
func (s *SocialService) GetFlowerBalance(userID string) (FlowerBalanceView, error) {
	if userID == "" {
		return FlowerBalanceView{}, ErrFlowerSenderRequired
	}
	var view FlowerBalanceView
	err := s.db.Transaction(func(tx *gorm.DB) error {
		bal, err := s.ensureFlowerBalanceToday(tx, userID)
		if err != nil {
			return err
		}
		view = FlowerBalanceView{
			Date:          bal.Date,
			GrantQuota:    bal.GrantQuota,
			ReceivedToday: bal.ReceivedToday,
			SpentToday:    bal.SpentToday,
			Available:     bal.Available(),
		}
		return nil
	})
	if err != nil {
		return FlowerBalanceView{}, err
	}
	received, err := s.countLifetimeReceived(userID)
	if err != nil {
		return FlowerBalanceView{}, err
	}
	sent, err := s.countLifetimeSent(userID)
	if err != nil {
		return FlowerBalanceView{}, err
	}
	view.LifetimeReceived = int(received)
	view.LifetimeSent = int(sent)
	return view, nil
}

// ResolveFlowerSpenderUserID exposes spender resolution for handlers (Agent → owner).
func (s *SocialService) ResolveFlowerSpenderUserID(userID, agentID string) (string, error) {
	return s.resolveSpenderUserID(s.db, userID, agentID)
}
