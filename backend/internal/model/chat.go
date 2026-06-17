package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ChatSession struct {
	ID           string        `gorm:"primaryKey;size:36" json:"id"`
	UserID       string        `gorm:"size:36;index;not null" json:"user_id"`
	User         User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	AgentID      string        `gorm:"size:36;index;not null" json:"agent_id"`
	Agent        Agent         `gorm:"foreignKey:AgentID" json:"agent,omitempty"`
	IdeaID       *string       `gorm:"size:36;index" json:"idea_id,omitempty"`
	Idea         *Idea         `gorm:"foreignKey:IdeaID" json:"idea,omitempty"`
	Title        string        `gorm:"size:500" json:"title"`
	MessageCount int           `gorm:"default:0" json:"message_count"`
	CreatedAt    time.Time     `gorm:"index" json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
	Messages     []ChatMessage `gorm:"foreignKey:SessionID" json:"messages,omitempty"`
}

func (s *ChatSession) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	return nil
}

type ChatMessage struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	SessionID string    `gorm:"size:36;index;not null" json:"session_id"`
	Role      string    `gorm:"size:20;not null;index" json:"role"` // user, assistant, system
	Content   string    `gorm:"type:text;not null" json:"content"`
	Metadata  string    `gorm:"type:json" json:"metadata,omitempty"`
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}

func (m *ChatMessage) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	// MySQL JSON 列不接受空字符串；空时设为最小合法 JSON
	if m.Metadata == "" {
		m.Metadata = "{}"
	}
	return nil
}
