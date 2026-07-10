package service

import (
	"fmt"
	"strings"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

type ModerationService struct {
	db *gorm.DB
}

func NewModerationService(db *gorm.DB) *ModerationService {
	return &ModerationService{db: db}
}

func (s *ModerationService) BlockUser(blockerID, blockedID string) error {
	if blockerID == blockedID {
		return fmt.Errorf("cannot block yourself")
	}
	var count int64
	s.db.Model(&model.User{}).Where("id = ?", blockedID).Count(&count)
	if count == 0 {
		return fmt.Errorf("user not found")
	}
	block := model.UserBlock{BlockerID: blockerID, BlockedID: blockedID}
	if err := s.db.Create(&block).Error; err != nil {
		return fmt.Errorf("already blocked or error: %w", err)
	}
	return nil
}

func (s *ModerationService) UnblockUser(blockerID, blockedID string) error {
	result := s.db.Where("blocker_id = ? AND blocked_id = ?", blockerID, blockedID).
		Delete(&model.UserBlock{})
	if result.RowsAffected == 0 {
		return fmt.Errorf("not blocked")
	}
	return nil
}

func (s *ModerationService) ListBlockedUsers(blockerID string) ([]model.User, error) {
	var blocks []model.UserBlock
	if err := s.db.Where("blocker_id = ?", blockerID).
		Order("created_at DESC").
		Preload("Blocked").
		Find(&blocks).Error; err != nil {
		return nil, err
	}
	users := make([]model.User, 0, len(blocks))
	for _, b := range blocks {
		users = append(users, b.Blocked)
	}
	return users, nil
}

func (s *ModerationService) BlockedUserIDs(blockerID string) ([]string, error) {
	var ids []string
	if err := s.db.Model(&model.UserBlock{}).
		Where("blocker_id = ?", blockerID).
		Pluck("blocked_id", &ids).Error; err != nil {
		return nil, err
	}
	return ids, nil
}

func (s *ModerationService) IsBlocked(blockerID, blockedID string) (bool, error) {
	var count int64
	err := s.db.Model(&model.UserBlock{}).
		Where("blocker_id = ? AND blocked_id = ?", blockerID, blockedID).
		Count(&count).Error
	return count > 0, err
}

func (s *ModerationService) SubmitReport(reporterID, targetType, targetID, reason, detail string) error {
	targetType = strings.TrimSpace(strings.ToLower(targetType))
	switch targetType {
	case "user", "idea", "comment":
	default:
		return fmt.Errorf("invalid target type")
	}
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return fmt.Errorf("reason required")
	}
	targetID = strings.TrimSpace(targetID)
	if targetID == "" {
		return fmt.Errorf("target id required")
	}
	detail = strings.TrimSpace(detail)
	if len(detail) > 1000 {
		detail = detail[:1000]
	}

	report := model.ContentReport{
		ReporterID: reporterID,
		TargetType: targetType,
		TargetID:   targetID,
		Reason:     reason,
		Detail:     detail,
	}
	return s.db.Create(&report).Error
}
