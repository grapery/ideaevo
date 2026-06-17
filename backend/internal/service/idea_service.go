package service

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

type IdeaService struct {
	db  *gorm.DB
	dedup *DedupEngine
	indexer *IdeaVectorIndexer
}

func NewIdeaService(db *gorm.DB) *IdeaService {
	return &IdeaService{
		db:    db,
		dedup: NewDedupEngine(db),
	}
}

// NewIdeaServiceWithDedup allows tests to inject a pre-constructed [DedupEngine]
// (typically carrying a mock [SimilaritySearcher]) without touching the database.
func NewIdeaServiceWithDedup(db *gorm.DB, d *DedupEngine) *IdeaService {
	return &IdeaService{db: db, dedup: d}
}

// SetVectorIndexer 注入向量索引器（在 main.go 中按需调用）。
// 注意采用 setter 而不是构造参数，避免环依赖（indexer 依赖 embed/store，
// 而 idea_service 是早期就实例化的核心服务）。
func (s *IdeaService) SetVectorIndexer(indexer *IdeaVectorIndexer) {
	s.indexer = indexer
}

// SetDedupSearcher 切换 dedup 底层使用的 searcher（向量检索就绪后由 main.go 注入）。
func (s *IdeaService) SetDedupSearcher(searcher SimilaritySearcher) {
	if s.dedup != nil && searcher != nil {
		s.dedup.SetSearcher(searcher)
	}
}

type RegisterIdeaInput struct {
	Title       string   `json:"title" binding:"required"`
	Description string   `json:"description" binding:"required"`
	Category    string   `json:"category" binding:"required"`
	Tags        []string `json:"tags"`
	RepoURL     string   `json:"repo_url"`
	DemoURL     string   `json:"demo_url"`
}

type DuplicateWarning struct {
	IsDuplicate    bool        `json:"is_duplicate"`
	SimilarIdeas   []IdeaMatch `json:"similar_ideas,omitempty"`
}

type IdeaMatch struct {
	Idea        model.Idea `json:"idea"`
	Similarity  float64    `json:"similarity"`
}

func (s *IdeaService) Register(agentID string, input RegisterIdeaInput) (*model.Idea, *DuplicateWarning, error) {
	// Check for duplicates
	dedupHash := generateDedupHash(input.Title, input.Description)
	warning, err := s.dedup.Check(input.Title, input.Description)
	if err != nil {
		return nil, nil, fmt.Errorf("dedup check failed: %w", err)
	}

	tagsJSON, _ := json.Marshal(input.Tags)

	idea := &model.Idea{
		AgentID:     agentID,
		Title:       input.Title,
		Description: input.Description,
		Status:      model.IdeaStatusActive,
		Category:    input.Category,
		Tags:        string(tagsJSON),
		RepoURL:     input.RepoURL,
		DemoURL:     input.DemoURL,
		DedupHash:   dedupHash,
	}

	if err := s.db.Create(idea).Error; err != nil {
		return nil, nil, fmt.Errorf("create idea failed: %w", err)
	}

	// 向量化索引（异步、降级容错）
	if s.indexer != nil {
		s.indexer.IndexIdea(idea)
	}

	logActivity(s.db, "agent", agentID, "register", "idea", idea.ID, nil)
	return idea, warning, nil
}

func (s *IdeaService) GetByID(id string) (*model.Idea, error) {
	var idea model.Idea
	if err := s.db.Preload("Agent").First(&idea, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &idea, nil
}

type QueryFilter struct {
	Status   string `form:"status"`
	Category string `form:"category"`
	AgentID  string `form:"agent_id"`
	Sort     string `form:"sort" binding:"omitempty,oneof=newest popular most_forked most_liked most_flowers"`
	Limit    int    `form:"limit" binding:"omitempty,min=1,max=100"`
	Offset   int    `form:"offset" binding:"omitempty,min=0"`
}

func (s *IdeaService) Query(filter QueryFilter) ([]model.Idea, int64, error) {
	if filter.Limit == 0 {
		filter.Limit = 20
	}

	query := s.db.Model(&model.Idea{})

	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Category != "" {
		query = query.Where("category = ?", filter.Category)
	}
	if filter.AgentID != "" {
		query = query.Where("agent_id = ?", filter.AgentID)
	}

	var total int64
	query.Count(&total)

	switch filter.Sort {
	case "popular":
		query = query.Order("like_count DESC, created_at DESC")
	case "most_forked":
		query = query.Order("fork_count DESC, created_at DESC")
	case "most_liked":
		query = query.Order("like_count DESC, created_at DESC")
	case "most_flowers":
		query = query.Order("flower_count DESC, created_at DESC")
	default:
		query = query.Order("created_at DESC")
	}

	var ideas []model.Idea
	if err := query.Preload("Agent").Offset(filter.Offset).Limit(filter.Limit).Find(&ideas).Error; err != nil {
		return nil, 0, err
	}

	return ideas, total, nil
}

func (s *IdeaService) Search(queryText string, threshold float64, limit int) ([]IdeaMatch, error) {
	if threshold == 0 {
		threshold = 0.3
	}
	if limit == 0 {
		limit = 10
	}
	return s.dedup.Search(queryText, threshold, limit)
}

func (s *IdeaService) Bury(ideaID, agentID, reason string) (*model.Idea, error) {
	var idea model.Idea
	if err := s.db.First(&idea, "id = ? AND agent_id = ?", ideaID, agentID).Error; err != nil {
		return nil, fmt.Errorf("idea not found or not owned by agent: %w", err)
	}

	now := time.Now()
	idea.Status = model.IdeaStatusBuried
	idea.BuriedAt = &now
	idea.BuriedReason = reason

	if err := s.db.Save(&idea).Error; err != nil {
		return nil, err
	}

	// bury 后从向量索引移除，避免在搜索/推荐中出现
	if s.indexer != nil {
		s.indexer.RemoveIdea(idea.ID)
	}

	logActivity(s.db, "agent", agentID, "bury", "idea", ideaID, map[string]string{"reason": reason})
	return &idea, nil
}

func (s *IdeaService) UpdateStatus(ideaID, status string) (*model.Idea, error) {
	var idea model.Idea
	if err := s.db.First(&idea, "id = ?", ideaID).Error; err != nil {
		return nil, err
	}

	idea.Status = model.IdeaStatus(status)
	if status == "buried" {
		now := time.Now()
		idea.BuriedAt = &now
	}

	if err := s.db.Save(&idea).Error; err != nil {
		return nil, err
	}

	// 同步向量索引状态
	if s.indexer != nil {
		if status == "buried" || status == "archived" {
			s.indexer.RemoveIdea(idea.ID)
		} else if status == "active" {
			// 状态可能从 buried 恢复为 active，需要重新索引
			s.indexer.IndexIdea(&idea)
		}
	}

	return &idea, nil
}

func generateDedupHash(title, description string) string {
	normalized := strings.ToLower(strings.TrimSpace(title + " " + description))
	h := sha256.Sum256([]byte(normalized))
	return fmt.Sprintf("%x", h[:16])
}
