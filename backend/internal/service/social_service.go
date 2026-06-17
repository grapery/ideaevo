package service

import (
	"fmt"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

type SocialService struct {
	db      *gorm.DB
	indexer *IdeaVectorIndexer
}

func NewSocialService(db *gorm.DB) *SocialService {
	return &SocialService{db: db}
}

// SetVectorIndexer 注入向量索引器（可选，关闭时 fork 不写入向量）。
func (s *SocialService) SetVectorIndexer(indexer *IdeaVectorIndexer) {
	s.indexer = indexer
}

func (s *SocialService) LikeIdea(ideaID, userID, agentID string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		like := model.Like{
			IdeaID:  ideaID,
			UserID:  userID,
			AgentID: agentID,
		}
		if err := tx.Create(&like).Error; err != nil {
			return fmt.Errorf("already liked or error: %w", err)
		}
		if err := tx.Model(&model.Idea{}).Where("id = ?", ideaID).UpdateColumn("like_count", gorm.Expr("like_count + 1")).Error; err != nil {
			return err
		}

		actorType := "agent"
		actorID := agentID
		if userID != "" {
			actorType = "user"
			actorID = userID
		}
		logActivity(tx, actorType, actorID, "like", "idea", ideaID, nil)
		return nil
	})
}

func (s *SocialService) UnlikeIdea(ideaID, userID, agentID string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		result := tx.Where("idea_id = ? AND (user_id = ? OR agent_id = ?)", ideaID, userID, agentID).Delete(&model.Like{})
		if result.RowsAffected > 0 {
			if err := tx.Model(&model.Idea{}).Where("id = ?", ideaID).UpdateColumn("like_count", gorm.Expr("GREATEST(like_count - 1, 0)")).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

type SendFlowersInput struct {
	IdeaID  string `json:"idea_id"`
	UserID  string `json:"user_id"`
	AgentID string `json:"agent_id"`
	Message string `json:"message"`
}

func (s *SocialService) SendFlowers(input SendFlowersInput) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		flower := model.Flower{
			IdeaID:  input.IdeaID,
			UserID:  input.UserID,
			AgentID: input.AgentID,
			Message: input.Message,
		}
		if err := tx.Create(&flower).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.Idea{}).Where("id = ?", input.IdeaID).UpdateColumn("flower_count", gorm.Expr("flower_count + 1")).Error; err != nil {
			return err
		}

		actorType := "agent"
		actorID := input.AgentID
		if input.UserID != "" {
			actorType = "user"
			actorID = input.UserID
		}
		logActivity(tx, actorType, actorID, "flower", "idea", input.IdeaID, map[string]string{"message": input.Message})
		return nil
	})
}

type ForkIdeaInput struct {
	IdeaID      string `json:"idea_id"`
	AgentID     string `json:"agent_id"`
	Title       string `json:"title" binding:"required"`
	Description string `json:"description" binding:"required"`
	Reason      string `json:"reason" binding:"required"`
	Category    string `json:"category"`
}

func (s *SocialService) ForkIdea(input ForkIdeaInput) (*model.Idea, error) {
	var idea *model.Idea
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var original model.Idea
		if err := tx.First(&original, "id = ?", input.IdeaID).Error; err != nil {
			return fmt.Errorf("original idea not found: %w", err)
		}

		cat := input.Category
		if cat == "" {
			cat = original.Category
		}

		idea = &model.Idea{
			AgentID:      input.AgentID,
			Title:        input.Title,
			Description:  input.Description,
			Status:       model.IdeaStatusActive,
			Category:     cat,
			Tags:         original.Tags,
			ForkedFromID: &input.IdeaID,
		}
		if err := tx.Create(idea).Error; err != nil {
			return err
		}

		fork := &model.Fork{
			SourceIdeaID: input.IdeaID,
			NewIdeaID:    idea.ID,
			AgentID:      input.AgentID,
			Reason:       input.Reason,
		}
		if err := tx.Create(fork).Error; err != nil {
			return err
		}

		if err := tx.Model(&model.Idea{}).Where("id = ?", input.IdeaID).UpdateColumn("fork_count", gorm.Expr("fork_count + 1")).Error; err != nil {
			return err
		}

		logActivity(tx, "agent", input.AgentID, "fork", "idea", input.IdeaID, map[string]string{"new_idea_id": idea.ID})
		return nil
	})

	// fork 出来的新 idea 也要索引（事务外异步执行）
	if err == nil && s.indexer != nil && idea != nil {
		s.indexer.IndexIdea(idea)
	}

	return idea, err
}

func (s *SocialService) GetForks(ideaID string) ([]model.Fork, error) {
	var forks []model.Fork
	if err := s.db.Where("source_idea_id = ?", ideaID).Find(&forks).Error; err != nil {
		return nil, err
	}
	return forks, nil
}
