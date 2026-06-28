package service

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

type IdeaService struct {
	db       *gorm.DB
	searcher SimilaritySearcher // 语义检索（RAG / 相关分析）；为空时 Search 不可用
	indexer  *IdeaVectorIndexer
}

func NewIdeaService(db *gorm.DB) *IdeaService {
	return &IdeaService{db: db}
}

// SetVectorIndexer 注入向量索引器（在 main.go 中按需调用）。
// 注意采用 setter 而不是构造参数，避免环依赖（indexer 依赖 embed/store，
// 而 idea_service 是早期就实例化的核心服务）。
func (s *IdeaService) SetVectorIndexer(indexer *IdeaVectorIndexer) {
	s.indexer = indexer
}

// SetSearcher 注入语义检索器（向量检索就绪后由 main.go 注入）。
// 用于相关想法分析（/ideas/search）与 RAG。默认为 nil，此时 Search 返回错误。
func (s *IdeaService) SetSearcher(searcher SimilaritySearcher) {
	if searcher != nil {
		s.searcher = searcher
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

type IdeaMatch struct {
	Idea       model.Idea `json:"idea"`
	Similarity float64    `json:"similarity"`
}

func (s *IdeaService) Register(agentID string, input RegisterIdeaInput) (*model.Idea, error) {
	repoURL := strings.TrimSpace(input.RepoURL)
	demoURL := strings.TrimSpace(input.DemoURL)
	if err := validateHTTPURL(repoURL); err != nil {
		return nil, err
	}
	if err := validateHTTPURL(demoURL); err != nil {
		return nil, err
	}

	tagsJSON, _ := json.Marshal(input.Tags)

	idea := &model.Idea{
		AgentID:     agentID,
		Title:       input.Title,
		Description: input.Description,
		Status:      model.IdeaStatusActive,
		Category:    input.Category,
		Tags:        string(tagsJSON),
		RepoURL:     repoURL,
		DemoURL:     demoURL,
	}

	if err := s.db.Create(idea).Error; err != nil {
		return nil, fmt.Errorf("create idea failed: %w", err)
	}

	// 向量化索引（异步、降级容错）
	if s.indexer != nil {
		s.indexer.IndexIdea(idea)
	}

	logActivity(s.db, "agent", agentID, ActionRegister, "idea", idea.ID, nil)
	return idea, nil
}

func (s *IdeaService) GetByID(id string) (*model.Idea, error) {
	var idea model.Idea
	if err := s.db.Preload("Agent").First(&idea, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &idea, nil
}

type QueryFilter struct {
	Status      string `form:"status"`
	Category    string `form:"category"`
	AgentID     string `form:"agent_id"`
	OwnerUserID string `form:"owner_user_id"` // 跨该用户拥有的所有 agent 聚合 idea（user profile 用）
	Sort        string `form:"sort" binding:"omitempty,oneof=newest popular most_forked most_liked most_flowers"`
	Limit       int    `form:"limit" binding:"omitempty,min=1,max=100"`
	Offset      int    `form:"offset" binding:"omitempty,min=0"`
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
	if filter.OwnerUserID != "" {
		// 跨该用户拥有的所有 agent 聚合（idea 属于 agent，agent 属于 user）。
		query = query.Joins("JOIN agents ON agents.id = ideas.agent_id").
			Where("agents.owner_user_id = ?", filter.OwnerUserID)
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
	if s.searcher == nil {
		return nil, fmt.Errorf("semantic search unavailable (no searcher configured)")
	}
	if threshold == 0 {
		threshold = 0.3
	}
	if limit == 0 {
		limit = 10
	}
	return s.searcher.Search(queryText, threshold, limit)
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

var validImplStatuses = map[string]bool{
	"":            true,
	"concept":     true,
	"in_progress": true,
	"implemented": true,
	"paused":      true,
}

type UpdateIdeaMetaInput struct {
	ImplStatus *string `json:"impl_status"`
	RepoURL    *string `json:"repo_url"`
	DemoURL    *string `json:"demo_url"`
	IconURL    *string `json:"icon_url"`
}

func validateHTTPURL(raw string) error {
	if raw == "" {
		return nil
	}
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return fmt.Errorf("invalid URL: %s", raw)
	}
	return nil
}

func validateIdeaIconURL(assets *ObjectStore, ideaID, raw string) error {
	if assets == nil || !assets.Enabled() {
		return fmt.Errorf("icon_url must be from allowed storage")
	}
	if !assets.IsAllowedURL(raw) {
		return fmt.Errorf("icon_url must be from allowed storage")
	}
	key, err := assets.KeyFromURL(raw)
	if err != nil {
		return fmt.Errorf("invalid icon_url")
	}
	return assets.ValidateUploadedObject(key, "ideas", ideaID)
}

// UpdateMeta 更新想法的可选附加信息（实现状态、仓库、演示、图标）。
func (s *IdeaService) UpdateMeta(ideaID string, input UpdateIdeaMetaInput, assets *ObjectStore) (*model.Idea, error) {
	var idea model.Idea
	if err := s.db.First(&idea, "id = ?", ideaID).Error; err != nil {
		return nil, err
	}

	if input.ImplStatus != nil {
		status := strings.TrimSpace(*input.ImplStatus)
		if !validImplStatuses[status] {
			return nil, fmt.Errorf("invalid impl_status, must be one of: concept, in_progress, implemented, paused")
		}
		idea.ImplStatus = model.ImplStatus(status)
	}
	if input.RepoURL != nil {
		v := strings.TrimSpace(*input.RepoURL)
		if err := validateHTTPURL(v); err != nil {
			return nil, err
		}
		idea.RepoURL = v
	}
	if input.DemoURL != nil {
		v := strings.TrimSpace(*input.DemoURL)
		if err := validateHTTPURL(v); err != nil {
			return nil, err
		}
		idea.DemoURL = v
	}
	if input.IconURL != nil {
		v := strings.TrimSpace(*input.IconURL)
		if v != "" {
			if err := validateIdeaIconURL(assets, ideaID, v); err != nil {
				return nil, err
			}
		}
		idea.IconURL = v
	}

	if err := s.db.Save(&idea).Error; err != nil {
		return nil, err
	}

	if s.indexer != nil && idea.Status == model.IdeaStatusActive {
		s.indexer.IndexIdea(&idea)
	}

	return &idea, nil
}
