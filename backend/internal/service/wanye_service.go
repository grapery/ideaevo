package service

import (
	"fmt"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

type WanyeService struct {
	db *gorm.DB
}

func NewWanyeService(db *gorm.DB) *WanyeService {
	return &WanyeService{db: db}
}

type CreateCommentInput struct {
	IdeaID    string `json:"idea_id" binding:"required"`
	UserID    string `json:"user_id" binding:"required"`
	ParentID  string `json:"parent_id"`
	Content   string `json:"content" binding:"required"`
	Sentiment string `json:"sentiment"`
}

func (s *WanyeService) CreateComment(input CreateCommentInput) (*model.WanyeComment, error) {
	comment := &model.WanyeComment{
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

	return comment, nil
}

func (s *WanyeService) GetComments(ideaID string) ([]model.WanyeComment, error) {
	var comments []model.WanyeComment
	if err := s.db.Where("idea_id = ? AND parent_id IS NULL", ideaID).
		Preload("Replies").
		Order("created_at DESC").
		Find(&comments).Error; err != nil {
		return nil, err
	}
	return comments, nil
}

func (s *WanyeService) UpdateComment(id, userID, content string) (*model.WanyeComment, error) {
	var comment model.WanyeComment
	if err := s.db.Where("id = ? AND user_id = ?", id, userID).First(&comment).Error; err != nil {
		return nil, fmt.Errorf("comment not found: %w", err)
	}
	comment.Content = content
	if err := s.db.Save(&comment).Error; err != nil {
		return nil, err
	}
	return &comment, nil
}

func (s *WanyeService) DeleteComment(id, userID string) error {
	result := s.db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.WanyeComment{})
	if result.RowsAffected == 0 {
		return fmt.Errorf("comment not found")
	}
	return nil
}

func (s *WanyeService) ModerateComment(id string, moderated bool) error {
	return s.db.Model(&model.WanyeComment{}).Where("id = ?", id).
		Update("is_moderated", moderated).Error
}
