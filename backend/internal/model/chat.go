package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	SessionTypeUserAgent  = "user_agent"  // 人与 Agent 对话
	SessionTypeAgentAgent = "agent_agent" // Agent 与 Agent 对话
)

const (
	MessageActorUser  = "user"
	MessageActorAgent = "agent"
)

// Assistant/user message content types for rendering.
const (
	MessageContentMarkdown = "markdown"
	MessageContentText     = "text"
	MessageContentJSON     = "json"
)

type ChatSession struct {
	ID           string        `gorm:"primaryKey;size:36" json:"id"`
	SessionType  string        `gorm:"size:20;default:user_agent;index;not null" json:"session_type"`
	UserID       string        `gorm:"size:36;index" json:"user_id,omitempty"`
	User         User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	AgentID      string        `gorm:"size:36;index;not null" json:"agent_id"`
	Agent        Agent         `gorm:"foreignKey:AgentID" json:"agent,omitempty"`
	PeerAgentID  *string       `gorm:"size:36;index" json:"peer_agent_id,omitempty"`
	PeerAgent    *Agent        `gorm:"foreignKey:PeerAgentID" json:"peer_agent,omitempty"`
	IdeaID       *string       `gorm:"size:36;index" json:"idea_id,omitempty"`
	Idea         *Idea         `gorm:"foreignKey:IdeaID" json:"idea,omitempty"`
	Title                 string        `gorm:"size:500" json:"title"`
	MessageCount          int           `gorm:"default:0" json:"message_count"`
	ForkedFromID          *string       `gorm:"size:36;index" json:"forked_from_id,omitempty"`
	ForkedBeforeMessageID *string       `gorm:"size:36" json:"forked_before_message_id,omitempty"`
	CreatedAt             time.Time     `gorm:"index" json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
	Messages     []ChatMessage `gorm:"foreignKey:SessionID" json:"messages,omitempty"`
}

func (s *ChatSession) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	if s.SessionType == "" {
		s.SessionType = SessionTypeUserAgent
	}
	return nil
}

type ChatMessage struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	SessionID string    `gorm:"size:36;index;not null" json:"session_id"`
	ActorType string    `gorm:"size:10;index" json:"actor_type"` // user | agent
	ActorID   string    `gorm:"size:36;index" json:"actor_id"`
	Role        string    `gorm:"size:20;not null;index" json:"role"` // user, assistant, system
	ContentType string    `gorm:"size:20;default:markdown" json:"content_type"`
	Content     string    `gorm:"type:text;not null" json:"content"`
	Metadata  string    `gorm:"type:json" json:"metadata,omitempty"`
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}

func (m *ChatMessage) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	if m.Metadata == "" {
		m.Metadata = "{}"
	}
	if m.ContentType == "" {
		if m.Role == "assistant" {
			m.ContentType = MessageContentMarkdown
		} else {
			m.ContentType = MessageContentText
		}
	}
	return nil
}
