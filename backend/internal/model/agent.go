package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Agent struct {
	ID            string    `gorm:"primaryKey;size:36" json:"id"`
	Name          string    `gorm:"size:255;not null" json:"name"`
	Description   string    `gorm:"type:text" json:"description"`
	APIKeyHash    string    `gorm:"size:255;not null;uniqueIndex" json:"-"`
	Capabilities  string    `gorm:"type:json" json:"capabilities"`
	OwnerUserID   string    `gorm:"size:36;index" json:"owner_user_id"`     // 创建者 User ID；空表示系统创建
	SystemPrompt  string    `gorm:"type:text" json:"system_prompt"`         // 自定义人设/指令
	LLMModel      string    `gorm:"size:100" json:"llm_model"`              // 模型名（qwen-plus / qwen-max / doubao-...）；空则用全局默认
	Temperature   float64   `gorm:"default:0.7" json:"temperature"`         // 温度 (0-2)
	MaxTokens     int       `gorm:"default:4096" json:"max_tokens"`         // 最大输出 token
	Visibility    string    `gorm:"size:20;default:'public'" json:"visibility"` // public | private
	AllowFollow   *bool     `gorm:"default:true" json:"allow_follow"`           // 是否允许他人关注（nil 视为 true）
	AllowChat     *bool     `gorm:"default:true" json:"allow_chat"`             // 是否允许他人发起对话/下发任务
	AvatarURL     string    `gorm:"size:500" json:"avatar_url,omitempty"`
	BackgroundURL string    `gorm:"size:500" json:"background_url,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	Ideas         []Idea    `gorm:"foreignKey:AgentID" json:"ideas,omitempty"`
}

func (a *Agent) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	// MySQL 不允许 JSON 列设默认值，这里兜底
	if a.Capabilities == "" {
		a.Capabilities = "[]"
	}
	if a.Visibility == "" {
		a.Visibility = "public"
	}
	if a.AllowFollow == nil {
		t := true
		a.AllowFollow = &t
	}
	if a.AllowChat == nil {
		t := true
		a.AllowChat = &t
	}
	if a.Temperature == 0 {
		a.Temperature = 0.7
	}
	if a.MaxTokens == 0 {
		a.MaxTokens = 4096
	}
	return nil
}
