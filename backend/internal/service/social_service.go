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

func (s *SocialService) HasLikedIdea(ideaID, userID, agentID string) bool {
	var count int64
	q := s.db.Model(&model.Like{}).Where("idea_id = ?", ideaID)
	if userID != "" {
		q = q.Where("user_id = ?", userID)
	} else if agentID != "" {
		q = q.Where("agent_id = ?", agentID)
	} else {
		return false
	}
	q.Count(&count)
	return count > 0
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

		logActivity(tx, "agent", input.AgentID, ActionFork, "idea", input.IdeaID, map[string]string{"new_idea_id": idea.ID})
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

// ShareIdea 记录一次"分享"活动事件（轻量转推语义，类似 GitHub/Twitter 转发）：
// 不复制 idea、不改任何计数，只在活动流里留下一条 share 记录，
// 这样它能出现在全局 / 关注 feed 流的白名单里。
// actorType/actorID 由调用方解析（agent 或 user）。
func (s *SocialService) ShareIdea(ideaID, actorType, actorID string) error {
	var count int64
	if err := s.db.Model(&model.Idea{}).Where("id = ? AND status = ?", ideaID, model.IdeaStatusActive).Count(&count).Error; err != nil {
		return fmt.Errorf("check idea failed: %w", err)
	}
	if count == 0 {
		return fmt.Errorf("idea not found or not active")
	}
	if actorID == "" {
		return fmt.Errorf("share requires an authenticated actor")
	}
	logActivity(s.db, actorType, actorID, ActionShare, "idea", ideaID, nil)
	return nil
}

// ---- emoji 反应（针对 idea，单选切换语义）----

// ReactToIdea 给 idea 加或切换 emoji 反应。同一 actor（user 或 agent）对同一 idea
// 只保留一个 emoji：已存在则 UPDATE，不存在则 INSERT。不记 activity（避免刷屏）。
func (s *SocialService) ReactToIdea(ideaID, userID, agentID, emoji string) error {
	if !model.IsAllowedEmoji(emoji) {
		return fmt.Errorf("unsupported emoji: %s", emoji)
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		var existing model.Reaction
		err := tx.Where("idea_id = ? AND (user_id = ? OR agent_id = ?)", ideaID, userID, agentID).First(&existing).Error
		if err == nil {
			// 已有反应 → 更新 emoji
			return tx.Model(&existing).Update("emoji", emoji).Error
		}
		// 不存在 → 新建
		r := &model.Reaction{IdeaID: ideaID, UserID: userID, AgentID: agentID, Emoji: emoji}
		return tx.Create(r).Error
	})
}

// UnreactIdea 移除当前 actor 对 idea 的反应。
func (s *SocialService) UnreactIdea(ideaID, userID, agentID string) error {
	return s.db.Where("idea_id = ? AND (user_id = ? OR agent_id = ?)", ideaID, userID, agentID).
		Delete(&model.Reaction{}).Error
}

// GetReactionCounts 返回某 idea 各 emoji 的计数 {👍:3, 🎉:1, ...}。
func (s *SocialService) GetReactionCounts(ideaID string) (map[string]int, error) {
	type emojiCount struct {
		Emoji string
		Cnt   int
	}
	var rows []emojiCount
	if err := s.db.Model(&model.Reaction{}).
		Select("emoji, COUNT(*) as cnt").
		Where("idea_id = ?", ideaID).
		Group("emoji").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	counts := make(map[string]int, len(rows))
	for _, r := range rows {
		counts[r.Emoji] = r.Cnt
	}
	return counts, nil
}

// GetMyReaction 返回当前 actor 对 idea 的 emoji（空=未反应）。
func (s *SocialService) GetMyReaction(ideaID, userID, agentID string) (string, error) {
	var r model.Reaction
	err := s.db.Where("idea_id = ? AND (user_id = ? OR agent_id = ?)", ideaID, userID, agentID).First(&r).Error
	if err != nil {
		return "", nil // 未反应不报错
	}
	return r.Emoji, nil
}

// GetBulkReactionCounts 批量返回多个 idea 的 reaction 计数，供 activity hydrate 用。
// 返回 map[ideaID]map[emoji]count。
func (s *SocialService) GetBulkReactionCounts(ideaIDs []string) (map[string]map[string]int, error) {
	result := make(map[string]map[string]int)
	if len(ideaIDs) == 0 {
		return result, nil
	}
	type row struct {
		IdeaID string
		Emoji  string
		Cnt    int
	}
	var rows []row
	if err := s.db.Model(&model.Reaction{}).
		Select("idea_id, emoji, COUNT(*) as cnt").
		Where("idea_id IN ?", ideaIDs).
		Group("idea_id, emoji").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		if result[r.IdeaID] == nil {
			result[r.IdeaID] = make(map[string]int)
		}
		result[r.IdeaID][r.Emoji] = r.Cnt
	}
	return result, nil
}
