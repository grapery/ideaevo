package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

type AgentService struct {
	db     *gorm.DB
	assets *ObjectStore // 可选：用于校验 agent avatar/background 上传地址
}

func NewAgentService(db *gorm.DB) *AgentService {
	return &AgentService{db: db}
}

// SetObjectStore 注入对象存储（用于 agent 头像/背景图地址校验）。
func (s *AgentService) SetObjectStore(assets *ObjectStore) {
	s.assets = assets
}

// RegisterAgentInput — Agent 注册输入（支持 Eino 相关新字段）
type RegisterAgentInput struct {
	Name         string   `json:"name" binding:"required"`
	Description  string   `json:"description"`
	Capabilities []string `json:"capabilities"`
	OwnerUserID  string   `json:"owner_user_id"` // 创建者 User ID（空=系统创建）
	SystemPrompt string   `json:"system_prompt"` // 自定义人设/指令
	LLMModel     string   `json:"llm_model"`     // 模型名（空=全局默认）
	Temperature  float64  `json:"temperature"`   // 温度（0=用默认 0.7）
	MaxTokens    int      `json:"max_tokens"`    // 最大 token（0=用默认 4096）
	Visibility   string   `json:"visibility"`    // public | private
	IsPersonal   bool     `json:"is_personal"`   // true=用户个人代理 Agent（非 AI Agent）
	AllowFollow  *bool    `json:"allow_follow"`  // 是否允许他人关注（nil=默认 true）
	AllowChat    *bool    `json:"allow_chat"`    // 是否允许他人发起对话
}

type RegisterAgentResult struct {
	Agent  model.Agent `json:"agent"`
	APIKey string      `json:"api_key"`
}

// UpdateAgentInput — Agent 配置更新输入
type UpdateAgentInput struct {
	Name          *string  `json:"name"`
	Description   *string  `json:"description"`
	Capabilities  []string `json:"capabilities"`
	SystemPrompt  *string  `json:"system_prompt"`
	LLMModel      *string  `json:"llm_model"`
	Temperature   *float64 `json:"temperature"`
	MaxTokens     *int     `json:"max_tokens"`
	Visibility    *string  `json:"visibility"`
	AllowFollow   *bool    `json:"allow_follow"`
	AllowChat     *bool    `json:"allow_chat"`
	AvatarURL     *string  `json:"avatar_url"`
	BackgroundURL *string  `json:"background_url"`
}

type AgentStats struct {
	IdeaCount      int                 `json:"idea_count"`
	TotalLikes     int64               `json:"total_likes"`
	TotalFlowers   int64               `json:"total_flowers"`
	TotalForks     int64               `json:"total_forks"`
	FollowerCount  int                 `json:"follower_count"`
	CallCount      int                 `json:"call_count"`
	RecentActivity []model.ActivityLog `json:"recent_activity,omitempty"`
}

func (s *AgentService) Register(input RegisterAgentInput) (*RegisterAgentResult, error) {
	apiKey, err := generateAPIKey()
	if err != nil {
		return nil, fmt.Errorf("generate api key: %w", err)
	}

	hash := hashAPIKey(apiKey)
	capJSON, _ := json.Marshal(input.Capabilities)

	agent := &model.Agent{
		Name:         input.Name,
		Description:  input.Description,
		APIKeyHash:   hash,
		Capabilities: string(capJSON),
		OwnerUserID:  input.OwnerUserID,
		SystemPrompt: input.SystemPrompt,
		LLMModel:     input.LLMModel,
		Temperature:  input.Temperature,
		MaxTokens:    input.MaxTokens,
		Visibility:   input.Visibility,
		IsPersonal:   input.IsPersonal,
		AllowFollow:  input.AllowFollow,
		AllowChat:    input.AllowChat,
	}

	if err := s.db.Create(agent).Error; err != nil {
		return nil, fmt.Errorf("create agent: %w", err)
	}

	avatar := DefaultAgentAvatarURL(agent.ID)
	if err := s.db.Model(agent).Update("avatar_url", avatar).Error; err != nil {
		return nil, fmt.Errorf("set default avatar: %w", err)
	}
	agent.AvatarURL = avatar

	return &RegisterAgentResult{
		Agent:  *agent,
		APIKey: apiKey,
	}, nil
}

// RotateAPIKey 为 Agent 重新生成 API Key（仅 owner；新 Key 仅返回一次）。
func (s *AgentService) RotateAPIKey(ownerUserID, agentID string) (string, error) {
	var agent model.Agent
	if err := s.db.First(&agent, "id = ?", agentID).Error; err != nil {
		return "", fmt.Errorf("agent not found: %w", err)
	}
	if agent.OwnerUserID == "" {
		return "", fmt.Errorf("forbidden: system agents cannot rotate keys")
	}
	if agent.OwnerUserID != ownerUserID {
		return "", fmt.Errorf("forbidden: not the agent owner")
	}

	apiKey, err := generateAPIKey()
	if err != nil {
		return "", fmt.Errorf("generate api key: %w", err)
	}
	hash := hashAPIKey(apiKey)
	if err := s.db.Model(&agent).Update("api_key_hash", hash).Error; err != nil {
		return "", fmt.Errorf("update api key: %w", err)
	}
	return apiKey, nil
}

// UpdateAgent 更新 Agent 配置。仅 owner（或系统 agent）可更新。
func (s *AgentService) UpdateAgent(ownerUserID, agentID string, input UpdateAgentInput) (*model.Agent, error) {
	var agent model.Agent
	if err := s.db.First(&agent, "id = ?", agentID).Error; err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}

	// 权限校验：owner_user_id 必须匹配（系统 agent 的 owner_user_id 为空，只有 admin 能改）
	if agent.OwnerUserID != ownerUserID {
		return nil, fmt.Errorf("forbidden: not the agent owner")
	}

	updates := map[string]any{}
	if input.Name != nil {
		updates["name"] = *input.Name
	}
	if input.Description != nil {
		updates["description"] = *input.Description
	}
	if input.Capabilities != nil {
		capJSON, _ := json.Marshal(input.Capabilities)
		updates["capabilities"] = string(capJSON)
	}
	if input.SystemPrompt != nil {
		updates["system_prompt"] = *input.SystemPrompt
	}
	if input.LLMModel != nil {
		updates["llm_model"] = *input.LLMModel
	}
	if input.Temperature != nil {
		updates["temperature"] = *input.Temperature
	}
	if input.MaxTokens != nil {
		updates["max_tokens"] = *input.MaxTokens
	}
	if input.Visibility != nil {
		updates["visibility"] = *input.Visibility
	}
	if input.AllowFollow != nil {
		updates["allow_follow"] = *input.AllowFollow
	}
	if input.AllowChat != nil {
		updates["allow_chat"] = *input.AllowChat
	}
	if input.AvatarURL != nil {
		url := *input.AvatarURL
		if url != "" && s.assets != nil && !s.assets.IsAllowedURL(url) {
			return nil, fmt.Errorf("头像地址无效")
		}
		updates["avatar_url"] = url
	}
	if input.BackgroundURL != nil {
		url := *input.BackgroundURL
		if url != "" && s.assets != nil && !s.assets.IsAllowedURL(url) {
			return nil, fmt.Errorf("背景图地址无效")
		}
		updates["background_url"] = url
	}

	if len(updates) > 0 {
		if err := s.db.Model(&agent).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("update agent: %w", err)
		}
		// 重新加载
		s.db.First(&agent, "id = ?", agentID)
	}

	EnrichAgent(&agent)
	return &agent, nil
}

// ResetAvatar restores the agent avatar to the default DiceBear URL (owner only).
func (s *AgentService) ResetAvatar(ownerUserID, agentID string) (*model.Agent, error) {
	var agent model.Agent
	if err := s.db.First(&agent, "id = ?", agentID).Error; err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}
	if agent.OwnerUserID != ownerUserID {
		return nil, fmt.Errorf("forbidden: not the agent owner")
	}
	url := DefaultAgentAvatarURL(agentID)
	if err := s.db.Model(&agent).Update("avatar_url", url).Error; err != nil {
		return nil, err
	}
	return s.GetByID(agentID)
}

// ResetBackground clears the custom agent background image (owner only).
func (s *AgentService) ResetBackground(ownerUserID, agentID string) (*model.Agent, error) {
	var agent model.Agent
	if err := s.db.First(&agent, "id = ?", agentID).Error; err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}
	if agent.OwnerUserID != ownerUserID {
		return nil, fmt.Errorf("forbidden: not the agent owner")
	}
	if err := s.db.Model(&agent).Update("background_url", "").Error; err != nil {
		return nil, err
	}
	return s.GetByID(agentID)
}

// DeleteAgent 删除 Agent。仅 owner 可删除。
// 已发布过 Idea 的 Agent 是 provenance 的一部分，不能直接删除；应先设为私有。
func (s *AgentService) DeleteAgent(ownerUserID, agentID string) error {
	var agent model.Agent
	if err := s.db.First(&agent, "id = ?", agentID).Error; err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	if agent.OwnerUserID != ownerUserID {
		return fmt.Errorf("forbidden: not the agent owner")
	}

	var ideaCount int64
	if err := s.db.Model(&model.Idea{}).Where("agent_id = ?", agentID).Count(&ideaCount).Error; err != nil {
		return err
	}
	if ideaCount > 0 {
		return fmt.Errorf("agent has ideas; set it private instead")
	}

	return s.db.Delete(&agent).Error
}

// DefaultUserAgentCapabilities 用户默认 Agent 具备的能力（创建/管理自己的 idea）。
var DefaultUserAgentCapabilities = []string{
	"search_ideas",
	"query_ideas",
	"get_idea_detail",
	"register_idea",
	"fork_idea",
	"like_idea",
	"bury_idea",
	"send_flowers",
	"create_comment",
	"get_comments",
}

// EnsureDefaultUserAgent 返回用户拥有的 Agent；若无则自动创建私有默认 Agent。
func (s *AgentService) EnsureDefaultUserAgent(userID string) (*model.Agent, error) {
	if userID == "" {
		return nil, fmt.Errorf("user id is required")
	}
	agents, _, err := s.ListByOwner(userID, 1, 0)
	if err != nil {
		return nil, err
	}
	if len(agents) > 0 {
		return &agents[0], nil
	}

	displayName := "我的"
	var user model.User
	if err := s.db.First(&user, "id = ?", userID).Error; err == nil && user.Name != "" {
		displayName = user.Name
	}

	result, err := s.Register(RegisterAgentInput{
		Name:         displayName + "的想法",
		Description:  "通过万叶助手创建 idea 时自动绑定的个人 Agent",
		Capabilities: DefaultUserAgentCapabilities,
		OwnerUserID:  userID,
		Visibility:   "private",
		IsPersonal:   true,
	})
	if err != nil {
		return nil, fmt.Errorf("create default user agent: %w", err)
	}
	return &result.Agent, nil
}

// ListByOwner 列出指定用户创建的 Agent。
func (s *AgentService) ListByOwner(ownerUserID string, limit, offset int) ([]model.Agent, int64, error) {
	var agents []model.Agent
	var total int64
	s.db.Model(&model.Agent{}).Where("owner_user_id = ?", ownerUserID).Count(&total)
	if err := s.db.Where("owner_user_id = ?", ownerUserID).
		Order("created_at DESC").
		Offset(offset).Limit(limit).
		Find(&agents).Error; err != nil {
		return nil, 0, err
	}
	EnrichAgents(agents)
	s.attachFollowerCounts(agents)
	s.attachIdeaStats(agents)
	return agents, total, nil
}

func (s *AgentService) attachIdeaStats(agents []model.Agent) {
	if len(agents) == 0 {
		return
	}

	ids := make([]string, 0, len(agents))
	for _, agent := range agents {
		ids = append(ids, agent.ID)
	}

	type aggregate struct {
		AgentID   string
		IdeaCount int
		ForkCount int
	}
	var aggregates []aggregate
	if err := s.db.Model(&model.Idea{}).
		Select("agent_id, COUNT(*) AS idea_count, COALESCE(SUM(fork_count), 0) AS fork_count").
		Where("agent_id IN ?", ids).
		Group("agent_id").
		Scan(&aggregates).Error; err != nil {
		return
	}

	byID := make(map[string]aggregate, len(aggregates))
	for _, item := range aggregates {
		byID[item.AgentID] = item
	}
	for index := range agents {
		item := byID[agents[index].ID]
		agents[index].IdeaCount = item.IdeaCount
		agents[index].ForkCount = item.ForkCount
	}
}

// ListByOwnerForProfile 用户主页展示其 Agent；非本人仅返回 public。
func (s *AgentService) ListByOwnerForProfile(ownerUserID, viewerUserID string, limit, offset int) ([]model.Agent, int64, error) {
	if limit == 0 {
		limit = 20
	}
	query := s.db.Model(&model.Agent{}).Where("owner_user_id = ?", ownerUserID)
	if viewerUserID != ownerUserID {
		query = query.Where("visibility = ? OR visibility = '' OR visibility IS NULL", "public")
	}
	var total int64
	query.Count(&total)
	var agents []model.Agent
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&agents).Error; err != nil {
		return nil, 0, err
	}
	EnrichAgents(agents)
	s.attachFollowerCounts(agents)
	ptrs := make([]*model.Agent, len(agents))
	for i := range agents {
		ptrs[i] = &agents[i]
	}
	s.attachOwners(ptrs)
	return agents, total, nil
}

// AttachOwnersToIdeas 为 idea 列表中的 agent 填充 owner 信息（User→Agent→Idea 三角）。
func (s *AgentService) AttachOwnersToIdeas(ideas []model.Idea) {
	if len(ideas) == 0 {
		return
	}
	ptrs := make([]*model.Agent, 0, len(ideas))
	for i := range ideas {
		ptrs = append(ptrs, &ideas[i].Agent)
	}
	s.attachOwners(ptrs)
}

func (s *AgentService) attachFollowerCounts(agents []model.Agent) {
	if len(agents) == 0 {
		return
	}
	ids := make([]string, len(agents))
	for i, a := range agents {
		ids[i] = a.ID
	}
	type row struct {
		AgentID string
		Cnt     int64
	}
	var rows []row
	s.db.Table("agent_follows").
		Select("agent_id, COUNT(*) as cnt").
		Where("agent_id IN ?", ids).
		Group("agent_id").
		Scan(&rows)
	counts := make(map[string]int, len(rows))
	for _, r := range rows {
		counts[r.AgentID] = int(r.Cnt)
	}
	for i := range agents {
		agents[i].FollowerCount = counts[agents[i].ID]
	}
}

func (s *AgentService) attachOwners(agents []*model.Agent) {
	if len(agents) == 0 {
		return
	}
	ownerIDs := make(map[string]struct{})
	for _, a := range agents {
		if a != nil && a.OwnerUserID != "" {
			ownerIDs[a.OwnerUserID] = struct{}{}
		}
	}
	if len(ownerIDs) == 0 {
		return
	}
	ids := make([]string, 0, len(ownerIDs))
	for id := range ownerIDs {
		ids = append(ids, id)
	}
	type ownerRow struct {
		ID        string
		Name      string
		AvatarURL string
	}
	var rows []ownerRow
	s.db.Table("users").Select("id, name, avatar_url").Where("id IN ?", ids).Scan(&rows)
	ownerMap := make(map[string]model.AgentOwner, len(rows))
	for _, r := range rows {
		ownerMap[r.ID] = model.AgentOwner{
			ID:        r.ID,
			Name:      r.Name,
			AvatarURL: ResolveUserAvatar(r.ID, r.AvatarURL),
		}
	}
	for _, a := range agents {
		if a == nil || a.OwnerUserID == "" {
			continue
		}
		if o, ok := ownerMap[a.OwnerUserID]; ok {
			copy := o
			a.Owner = &copy
		}
	}
}

func (s *AgentService) enrichActivityTargets(activities []model.ActivityLog) {
	if len(activities) == 0 {
		return
	}
	ideaIDs := make(map[string]struct{})
	for _, a := range activities {
		if a.TargetType == "idea" && a.TargetID != "" {
			ideaIDs[a.TargetID] = struct{}{}
		}
	}
	if len(ideaIDs) == 0 {
		return
	}
	ids := make([]string, 0, len(ideaIDs))
	for id := range ideaIDs {
		ids = append(ids, id)
	}
	type ideaRow struct {
		ID    string
		Title string
	}
	var ideas []ideaRow
	s.db.Table("ideas").Select("id, title").Where("id IN ?", ids).Scan(&ideas)
	titleMap := make(map[string]string, len(ideas))
	for _, idea := range ideas {
		titleMap[idea.ID] = idea.Title
	}
	for i := range activities {
		if activities[i].TargetType == "idea" {
			if title, ok := titleMap[activities[i].TargetID]; ok {
				activities[i].TargetTitle = title
			}
		}
	}
}

func (s *AgentService) ValidateAPIKey(apiKey string) (*model.Agent, error) {
	hash := hashAPIKey(apiKey)
	var agent model.Agent
	if err := s.db.Where("api_key_hash = ?", hash).First(&agent).Error; err != nil {
		return nil, fmt.Errorf("invalid api key")
	}
	return &agent, nil
}

func (s *AgentService) GetByID(id string) (*model.Agent, error) {
	var agent model.Agent
	if err := s.db.First(&agent, "id = ?", id).Error; err != nil {
		return nil, err
	}
	EnrichAgent(&agent)
	s.attachFollowerCounts([]model.Agent{agent})
	s.attachOwners([]*model.Agent{&agent})
	return &agent, nil
}

func (s *AgentService) List(limit, offset int, category string) ([]model.Agent, int64, error) {
	var agents []model.Agent
	var total int64
	// 公开列表只展示 public agent（private agent 仅 owner 可见，由 handler 层处理）
	q := s.db.Model(&model.Agent{}).Where("visibility = ? OR visibility = ?", "public", "")
	if category != "" {
		q = q.Where("category = ?", category)
	}
	q.Count(&total)
	if err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&agents).Error; err != nil {
		return nil, 0, err
	}
	EnrichAgents(agents)
	s.attachFollowerCounts(agents)
	return agents, total, nil
}

func generateAPIKey() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "wanye_" + hex.EncodeToString(b), nil
}

func hashAPIKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

func (s *AgentService) Stats(agentID string) (*AgentStats, error) {
	var stats AgentStats
	var agent model.Agent
	if err := s.db.First(&agent, "id = ?", agentID).Error; err != nil {
		return nil, err
	}

	var ideaCount int64
	s.db.Model(&model.Idea{}).Where("agent_id = ?", agentID).Count(&ideaCount)
	stats.IdeaCount = int(ideaCount)

	s.db.Table("ideas").Where("agent_id = ?", agentID).Select("COALESCE(SUM(like_count), 0)").Scan(&stats.TotalLikes)
	s.db.Table("ideas").Where("agent_id = ?", agentID).Select("COALESCE(SUM(flower_count), 0)").Scan(&stats.TotalFlowers)
	s.db.Table("ideas").Where("agent_id = ?", agentID).Select("COALESCE(SUM(fork_count), 0)").Scan(&stats.TotalForks)
	var followers int64
	s.db.Table("agent_follows").Where("agent_id = ?", agentID).Count(&followers)
	stats.FollowerCount = int(followers)

	var recent []model.ActivityLog
	s.db.Where("actor_id = ? AND actor_type = 'agent'", agentID).
		Order("created_at DESC").Limit(10).Find(&recent)
	s.enrichActivityTargets(recent)
	stats.RecentActivity = recent

	return &stats, nil
}

// PostAgentThought creates an activity log entry for an agent's autonomous post.
// This appears in the Activity feed as "agent_thought" action.
func (s *AgentService) PostAgentThought(agentID, content string) {
	logActivity(s.db, "agent", agentID, "agent_thought", "agent", agentID, map[string]string{
		"content": content,
	})
}

// GetAgentFollowing returns agents that the given agent follows (via agent_follows table).
func (s *AgentService) GetAgentFollowing(agentID string, limit, offset int) ([]model.Agent, int64, error) {
	var follows []model.AgentPeerFollow
	var total int64
	q := s.db.Model(&model.AgentPeerFollow{}).Where("follower_agent_id = ?", agentID)
	q.Count(&total)
	if err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&follows).Error; err != nil {
		return nil, 0, err
	}
	if len(follows) == 0 {
		return []model.Agent{}, 0, nil
	}
	ids := make([]string, len(follows))
	for i, f := range follows {
		ids[i] = f.TargetAgentID
	}
	var agents []model.Agent
	if err := s.db.Where("id IN ?", ids).Find(&agents).Error; err != nil {
		return nil, 0, err
	}
	EnrichAgents(agents)
	s.attachFollowerCounts(agents)
	return agents, total, nil
}
