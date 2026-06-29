package service

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"sort"
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

const registerDuplicateThreshold = 0.80

// FindSimilarForRegister 在注册前检索与用户草稿高度相似的 idea（自有 + 全站）。
func (s *IdeaService) FindSimilarForRegister(ownerUserID, title, description string) ([]IdeaMatch, error) {
	if s.searcher == nil {
		return nil, nil
	}
	query := strings.TrimSpace(title + "\n" + description)
	if query == "" {
		return nil, nil
	}

	seen := make(map[string]bool)
	var out []IdeaMatch

	if ownerUserID != "" {
		mine, err := s.searcher.Search(query, SearchOptions{
			OwnerUserID: ownerUserID,
			Threshold:   registerDuplicateThreshold,
			Limit:       3,
		})
		if err != nil {
			return nil, err
		}
		for _, m := range mine {
			if seen[m.Idea.ID] {
				continue
			}
			out = append(out, m)
			seen[m.Idea.ID] = true
		}
	}

	global, err := s.searcher.Search(query, SearchOptions{
		Status:    "active",
		Threshold: registerDuplicateThreshold,
		Limit:     3,
	})
	if err != nil {
		return nil, err
	}
	for _, m := range global {
		if seen[m.Idea.ID] {
			continue
		}
		out = append(out, m)
		seen[m.Idea.ID] = true
	}
	sortIdeaMatchesBySimilarity(out)
	return out, nil
}

// sortIdeaMatchesBySimilarity 按相似度降序排列。
func sortIdeaMatchesBySimilarity(matches []IdeaMatch) {
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].Similarity > matches[j].Similarity
	})
}

// MaxIdeaMatchSimilarity 返回列表中最高相似度。
func MaxIdeaMatchSimilarity(matches []IdeaMatch) float64 {
	max := 0.0
	for _, m := range matches {
		if m.Similarity > max {
			max = m.Similarity
		}
	}
	return max
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

	if err := AppendIdeaVersion(s.db, idea, "初始版本"); err != nil {
		return nil, fmt.Errorf("create initial version failed: %w", err)
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

func (s *IdeaService) Search(queryText string, opts SearchOptions) ([]IdeaMatch, error) {
	if s.searcher == nil {
		return nil, fmt.Errorf("semantic search unavailable (no searcher configured)")
	}
	opts = NormalizeSearchOptions(opts)
	return s.searcher.Search(queryText, opts)
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

	// 同步向量索引状态：向量库仅保留 active idea
	if s.indexer != nil {
		if status == string(model.IdeaStatusActive) {
			s.indexer.IndexIdea(&idea)
		} else {
			s.indexer.RemoveIdea(idea.ID)
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

// IdeaVersionSummary 版本列表项（不含正文，减少传输）。
type IdeaVersionSummary struct {
	ID        string    `json:"id"`
	Version   int       `json:"version"`
	Changelog string    `json:"changelog"`
	CreatedAt time.Time `json:"created_at"`
	IsCurrent bool      `json:"is_current"`
}

// AppendIdeaVersion 为 idea 追加一条描述版本记录。
func AppendIdeaVersion(db *gorm.DB, idea *model.Idea, changelog string) error {
	var maxVer int
	if err := db.Model(&model.IdeaVersion{}).Where("idea_id = ?", idea.ID).
		Select("COALESCE(MAX(version), 0)").Scan(&maxVer).Error; err != nil {
		return err
	}
	if strings.TrimSpace(changelog) == "" {
		if maxVer == 0 {
			changelog = "初始版本"
		} else {
			changelog = fmt.Sprintf("版本 %d", maxVer+1)
		}
	}
	v := &model.IdeaVersion{
		IdeaID:      idea.ID,
		Version:     maxVer + 1,
		Title:       idea.Title,
		Description: idea.Description,
		Changelog:   changelog,
	}
	return db.Create(v).Error
}

// EnsureVersions 为尚无版本记录的历史 idea 回填 v1。
func (s *IdeaService) EnsureVersions(ideaID string) error {
	var count int64
	if err := s.db.Model(&model.IdeaVersion{}).Where("idea_id = ?", ideaID).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	var idea model.Idea
	if err := s.db.First(&idea, "id = ?", ideaID).Error; err != nil {
		return err
	}
	return AppendIdeaVersion(s.db, &idea, "初始版本")
}

// ListVersions 返回 idea 的描述版本时间线（从旧到新）。
func (s *IdeaService) ListVersions(ideaID string) ([]IdeaVersionSummary, error) {
	if err := s.EnsureVersions(ideaID); err != nil {
		return nil, err
	}
	var versions []model.IdeaVersion
	if err := s.db.Where("idea_id = ?", ideaID).Order("version ASC").Find(&versions).Error; err != nil {
		return nil, err
	}
	currentID := ""
	if len(versions) > 0 {
		currentID = versions[len(versions)-1].ID
	}
	out := make([]IdeaVersionSummary, len(versions))
	for i, v := range versions {
		out[i] = IdeaVersionSummary{
			ID:        v.ID,
			Version:   v.Version,
			Changelog: v.Changelog,
			CreatedAt: v.CreatedAt,
			IsCurrent: v.ID == currentID,
		}
	}
	return out, nil
}

// GetVersion 按版本 ID 获取完整快照。
func (s *IdeaService) GetVersion(ideaID, versionID string) (*model.IdeaVersion, error) {
	if err := s.EnsureVersions(ideaID); err != nil {
		return nil, err
	}
	var v model.IdeaVersion
	if err := s.db.Where("id = ? AND idea_id = ?", versionID, ideaID).First(&v).Error; err != nil {
		return nil, err
	}
	return &v, nil
}

type UpdateDescriptionInput struct {
	Description string `json:"description" binding:"required"`
	Changelog   string `json:"changelog"`
}

var markdownImageRE = regexp.MustCompile(`!\[[^\]]*\]\(([^)]+)\)`)

func validateDescriptionImages(assets *ObjectStore, ideaID, description string) error {
	matches := markdownImageRE.FindAllStringSubmatch(description, -1)
	if len(matches) == 0 {
		return nil
	}
	if assets == nil || !assets.Enabled() {
		return fmt.Errorf("description image must be from allowed storage")
	}
	for _, m := range matches {
		raw := normalizeMarkdownImageURL(m[1])
		if raw == "" {
			continue
		}
		if !assets.IsAllowedURL(raw) {
			return fmt.Errorf("description image must be from allowed storage")
		}
		key, err := assets.KeyFromURL(raw)
		if err != nil {
			return fmt.Errorf("invalid description image")
		}
		if !strings.HasPrefix(key, fmt.Sprintf("ideas/%s/content/", ideaID)) {
			return fmt.Errorf("description image must belong to this idea")
		}
		if err := validateUploadedObjectWithRetry(assets, key, "ideas", ideaID); err != nil {
			return err
		}
	}
	return nil
}

func normalizeMarkdownImageURL(raw string) string {
	raw = strings.TrimSpace(raw)
	raw = strings.Trim(raw, "\"'")
	if strings.HasPrefix(raw, "<") && strings.HasSuffix(raw, ">") {
		raw = strings.Trim(raw, "<>")
	}
	return strings.TrimSpace(raw)
}

func validateUploadedObjectWithRetry(assets *ObjectStore, key, scope, id string) error {
	var last error
	for attempt := 0; attempt < 4; attempt++ {
		if err := assets.ValidateUploadedObject(key, scope, id); err == nil {
			return nil
		} else {
			last = err
			time.Sleep(200 * time.Millisecond)
		}
	}
	return last
}

// UpdateDescription 更新 Markdown 描述并追加新版本（仅创建者调用）。
func (s *IdeaService) UpdateDescription(ideaID string, input UpdateDescriptionInput, assets *ObjectStore) (*model.Idea, error) {
	desc := strings.TrimSpace(input.Description)
	if desc == "" {
		return nil, fmt.Errorf("description is required")
	}
	if err := validateDescriptionImages(assets, ideaID, desc); err != nil {
		return nil, err
	}

	var idea model.Idea
	if err := s.db.First(&idea, "id = ?", ideaID).Error; err != nil {
		return nil, err
	}

	idea.Description = desc
	changelog := strings.TrimSpace(input.Changelog)

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&idea).Update("description", desc).Error; err != nil {
			return err
		}
		return AppendIdeaVersion(tx, &idea, changelog)
	})
	if err != nil {
		return nil, err
	}

	if s.indexer != nil && idea.Status == model.IdeaStatusActive {
		s.indexer.IndexIdea(&idea)
	}

	return &idea, nil
}
