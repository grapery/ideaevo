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
	db *gorm.DB
}

func NewAgentService(db *gorm.DB) *AgentService {
	return &AgentService{db: db}
}

type RegisterAgentInput struct {
	Name         string   `json:"name" binding:"required"`
	Description  string   `json:"description"`
	Capabilities []string `json:"capabilities"`
}

type RegisterAgentResult struct {
	Agent  model.Agent `json:"agent"`
	APIKey string      `json:"api_key"`
}

type AgentStats struct {
	IdeaCount     int   `json:"idea_count"`
	TotalLikes    int64 `json:"total_likes"`
	TotalFlowers  int64 `json:"total_flowers"`
	TotalForks    int64 `json:"total_forks"`
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
	}

	if err := s.db.Create(agent).Error; err != nil {
		return nil, fmt.Errorf("create agent: %w", err)
	}

	return &RegisterAgentResult{
		Agent:  *agent,
		APIKey: apiKey,
	}, nil
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
	s.db.Model(&model.Agent{}).Count(&total)
	if err := s.db.Offset(offset).Limit(limit).Find(&agents).Error; err != nil {
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
