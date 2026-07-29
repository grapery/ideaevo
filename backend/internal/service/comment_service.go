package service

import (
	"fmt"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

type CommentService struct {
	db    *gorm.DB
	notif *NotificationService
	mod   *ModerationService
}

func NewCommentService(db *gorm.DB) *CommentService {
	return &CommentService{db: db}
}

// SetNotificationService 注入通知服务（用于评论通知）。
func (s *CommentService) SetNotificationService(notif *NotificationService) {
	s.notif = notif
}

func (s *CommentService) SetModerationService(mod *ModerationService) {
	s.mod = mod
}

// notifyIdeaOwner 向 idea 的 owner 发送通知（非阻塞）。
func (s *CommentService) notifyIdeaOwner(ideaID, actorID, action, summary string) {
	if s.notif == nil {
		return
	}
	var agentID string
	if err := s.db.Model(&model.Idea{}).Where("id = ?", ideaID).Pluck("agent_id", &agentID).Error; err != nil || agentID == "" {
		return
	}
	var ownerUserID string
	if err := s.db.Model(&model.Agent{}).Where("id = ?", agentID).Pluck("owner_user_id", &ownerUserID).Error; err != nil || ownerUserID == "" {
		return
	}
	_ = s.notif.Create(ownerUserID, "user", actorID, "", action, "idea", ideaID, summary)
}

type CreateCommentInput struct {
	IdeaID    string `json:"idea_id"` // 由 handler 从 URL 路径填充
	UserID    string `json:"user_id"` // 由 handler 从鉴权身份填充
	ParentID  string `json:"parent_id"`
	Content   string `json:"content" binding:"required"`
	Sentiment string `json:"sentiment"`
}

func (s *CommentService) CreateComment(input CreateCommentInput) (*model.Comment, error) {
	if s.mod != nil {
		if err := s.mod.EnsureCommentInteraction(input.IdeaID, input.UserID); err != nil {
			return nil, err
		}
	}
	comment := &model.Comment{
		IdeaID:    input.IdeaID,
		UserID:    input.UserID,
		Content:   input.Content,
		Sentiment: model.CommentSentiment(input.Sentiment),
	}
	if input.ParentID != "" {
		comment.ParentID = &input.ParentID
	}
	if err := s.db.Create(comment).Error; err != nil {
		return nil, err
	}

	s.db.Model(&model.Idea{}).Where("id = ?", input.IdeaID).
		UpdateColumn("comment_count", gorm.Expr("comment_count + 1"))

	// 评论通知（self-action 守卫已在 Create 内处理）
	summary := input.Content
	if len(summary) > 50 {
		summary = summary[:50]
	}
	s.notifyIdeaOwner(input.IdeaID, input.UserID, "comment", summary)

	return comment, nil
}

func (s *CommentService) GetComments(ideaID string) ([]model.Comment, error) {
	var comments []model.Comment
	if err := s.db.Where("idea_id = ? AND parent_id IS NULL AND is_moderated = ?", ideaID, false).
		Preload("Replies", "is_moderated = ?", false).
		Order("created_at DESC").
		Find(&comments).Error; err != nil {
		return nil, err
	}
	return comments, nil
}

func (s *CommentService) GetCommentsEnriched(ideaID string) ([]CommentView, error) {
	comments, err := s.GetComments(ideaID)
	if err != nil {
		return nil, err
	}
	return EnrichComments(s.db, comments), nil
}

type AdminCommentFilter struct {
	Moderated *bool
	IdeaID    string
	Limit     int
	Offset    int
}

func (s *CommentService) ListCommentsAdmin(filter AdminCommentFilter) ([]model.Comment, int64, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	q := s.db.Model(&model.Comment{})
	if filter.Moderated != nil {
		q = q.Where("is_moderated = ?", *filter.Moderated)
	}
	if filter.IdeaID != "" {
		q = q.Where("idea_id = ?", filter.IdeaID)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var comments []model.Comment
	if err := q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&comments).Error; err != nil {
		return nil, 0, err
	}
	return comments, total, nil
}

func (s *CommentService) UpdateComment(id, userID, content string) (*model.Comment, error) {
	var comment model.Comment
	if err := s.db.Where("id = ? AND user_id = ?", id, userID).First(&comment).Error; err != nil {
		return nil, fmt.Errorf("comment not found: %w", err)
	}
	comment.Content = content
	if err := s.db.Save(&comment).Error; err != nil {
		return nil, err
	}
	return &comment, nil
}

func (s *CommentService) DeleteComment(id, userID string) error {
	var comment model.Comment
	if err := s.db.Where("id = ? AND user_id = ?", id, userID).First(&comment).Error; err != nil {
		return fmt.Errorf("comment not found")
	}
	if err := s.db.Delete(&comment).Error; err != nil {
		return err
	}
	s.db.Model(&model.Idea{}).Where("id = ? AND comment_count > 0", comment.IdeaID).
		UpdateColumn("comment_count", gorm.Expr("comment_count - 1"))
	return nil
}

func (s *CommentService) ModerateComment(id string, moderated bool) error {
	return s.db.Model(&model.Comment{}).Where("id = ?", id).
		Update("is_moderated", moderated).Error
}
