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
	if err := s.db.Model(&model.User{}).Where("id = ?", blockedID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return fmt.Errorf("user not found")
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		block := model.UserBlock{BlockerID: blockerID, BlockedID: blockedID}
		if err := tx.Where("blocker_id = ? AND blocked_id = ?", blockerID, blockedID).
			FirstOrCreate(&block).Error; err != nil {
			return err
		}

		// 屏蔽立即切断双方已有关注关系，避免关注流继续暴露对方内容。
		if err := tx.Where(
			"(follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)",
			blockerID, blockedID, blockedID, blockerID,
		).Delete(&model.Follow{}).Error; err != nil {
			return err
		}
		return refreshFollowCounts(tx, blockerID, blockedID)
	})
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

// BlockStatus 返回当前用户与目标用户之间的双向屏蔽状态。
func (s *ModerationService) BlockStatus(viewerID, targetID string) (blocked, blockedBy bool, err error) {
	if viewerID == "" || targetID == "" {
		return false, false, fmt.Errorf("user id required")
	}
	var blocks []model.UserBlock
	err = s.db.Where(
		"(blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)",
		viewerID, targetID, targetID, viewerID,
	).Find(&blocks).Error
	if err != nil {
		return false, false, err
	}
	for _, block := range blocks {
		if block.BlockerID == viewerID {
			blocked = true
		}
		if block.BlockerID == targetID {
			blockedBy = true
		}
	}
	return blocked, blockedBy, nil
}

// EnsureUsersCanInteract 拒绝任一方向存在屏蔽关系的用户互动。
func (s *ModerationService) EnsureUsersCanInteract(userA, userB string) error {
	if userA == "" || userB == "" || userA == userB {
		return nil
	}
	var count int64
	if err := s.db.Model(&model.UserBlock{}).Where(
		"(blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)",
		userA, userB, userB, userA,
	).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("interaction blocked")
	}
	return nil
}

// EnsureAgentInteraction 校验用户是否可与目标 Agent 的创建者互动。
func (s *ModerationService) EnsureAgentInteraction(userID, agentID string) error {
	if userID == "" || agentID == "" {
		return nil
	}
	var ownerID string
	if err := s.db.Model(&model.Agent{}).Where("id = ?", agentID).
		Pluck("owner_user_id", &ownerID).Error; err != nil {
		return err
	}
	return s.EnsureUsersCanInteract(userID, ownerID)
}

// EnsureIdeaInteraction 将用户或 Agent 身份解析为所属用户，并校验 Idea 创建者。
func (s *ModerationService) EnsureIdeaInteraction(ideaID, userID, agentID string) error {
	actorOwnerID := userID
	if actorOwnerID == "" && agentID != "" {
		if err := s.db.Model(&model.Agent{}).Where("id = ?", agentID).
			Pluck("owner_user_id", &actorOwnerID).Error; err != nil {
			return err
		}
	}
	if actorOwnerID == "" || ideaID == "" {
		return nil
	}

	var ideaOwnerID string
	if err := s.db.Table("ideas").
		Select("agents.owner_user_id").
		Joins("JOIN agents ON agents.id = ideas.agent_id").
		Where("ideas.id = ?", ideaID).
		Scan(&ideaOwnerID).Error; err != nil {
		return err
	}
	return s.EnsureUsersCanInteract(actorOwnerID, ideaOwnerID)
}

// EnsureCommentInteraction 兼容评论 actor 字段可能存 User ID 或 Agent ID 的历史契约。
func (s *ModerationService) EnsureCommentInteraction(ideaID, actorID string) error {
	if actorID == "" {
		return nil
	}
	var userCount int64
	if err := s.db.Model(&model.User{}).Where("id = ?", actorID).Count(&userCount).Error; err != nil {
		return err
	}
	if userCount > 0 {
		return s.EnsureIdeaInteraction(ideaID, actorID, "")
	}
	return s.EnsureIdeaInteraction(ideaID, "", actorID)
}

func refreshFollowCounts(tx *gorm.DB, userIDs ...string) error {
	for _, userID := range userIDs {
		var followerCount, followingCount int64
		if err := tx.Model(&model.Follow{}).Where("following_id = ?", userID).Count(&followerCount).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.Follow{}).Where("follower_id = ?", userID).Count(&followingCount).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]any{
			"follower_count":  followerCount,
			"following_count": followingCount,
		}).Error; err != nil {
			return err
		}
	}
	return nil
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
