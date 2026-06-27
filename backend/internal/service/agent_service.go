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
	OwnerUserID  string   `json:"owner_user_id"`   // 创建者 User ID（空=系统创建）
	SystemPrompt string   `json:"system_prompt"`   // 自定义人设/指令
	LLMModel     string   `json:"llm_model"`       // 模型名（空=全局默认）
	Temperature  float64  `json:"temperature"`     // 温度（0=用默认 0.7）
	MaxTokens    int      `json:"max_tokens"`      // 最大 token（0=用默认 4096）
	Visibility   string   `json:"visibility"`      // public | private
	AllowFollow  *bool    `json:"allow_follow"`    // 是否允许他人关注（nil=默认 true）
	AllowChat    *bool    `json:"allow_chat"`      // 是否允许他人发起对话
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
	IdeaCount      int                  `json:"idea_count"`
	TotalLikes     int64                `json:"total_likes"`
	TotalFlowers   int64                `json:"total_flowers"`
	TotalForks     int64                `json:"total_forks"`
	RecentActivity []model.ActivityLog  `json:"recent_activity,omitempty"`
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
		AllowFollow:  input.AllowFollow,
		AllowChat:    input.AllowChat,
	}

	if err := s.db.Create(agent).Error; err != nil {
		return nil, fmt.Errorf("create agent: %w", err)
	}

	return &RegisterAgentResult{
		Agent:  *agent,
		APIKey: apiKey,
	}, nil
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

	return &agent, nil
}

// DeleteAgent 删除 Agent。仅 owner 可删除。
// 不会级联删除 ideas（ideas 保留，agent_id 变为悬空——由前端处理显示）。
func (s *AgentService) DeleteAgent(ownerUserID, agentID string) error {
	var agent model.Agent
	if err := s.db.First(&agent, "id = ?", agentID).Error; err != nil {
		return fmt.Errorf("agent not found: %w", err)
	}

	if agent.OwnerUserID != ownerUserID {
		return fmt.Errorf("forbidden: not the agent owner")
	}

	return s.db.Delete(&agent).Error
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
	return agents, total, nil
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
	return &agent, nil
}

func (s *AgentService) List(limit, offset int) ([]model.Agent, int64, error) {
	var agents []model.Agent
	var total int64
	// 公开列表只展示 public agent（private agent 仅 owner 可见，由 handler 层处理）
	q := s.db.Model(&model.Agent{}).Where("visibility = ? OR visibility = ?", "public", "")
	q.Count(&total)
	if err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&agents).Error; err != nil {
		return nil, 0, err
	}
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

	var ideaCount int64
	s.db.Model(&model.Idea{}).Where("agent_id = ?", agentID).Count(&ideaCount)
	stats.IdeaCount = int(ideaCount)

	s.db.Table("ideas").Where("agent_id = ?", agentID).Select("COALESCE(SUM(like_count), 0)").Scan(&stats.TotalLikes)
	s.db.Table("ideas").Where("agent_id = ?", agentID).Select("COALESCE(SUM(flower_count), 0)").Scan(&stats.TotalFlowers)
	s.db.Table("ideas").Where("agent_id = ?", agentID).Select("COALESCE(SUM(fork_count), 0)").Scan(&stats.TotalForks)

	var recent []model.ActivityLog
	s.db.Where("actor_id = ? AND actor_type = 'agent'", agentID).
		Order("created_at DESC").Limit(10).Find(&recent)
	stats.RecentActivity = recent

	return &stats, nil
}
