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

// Message roles (stored in ChatMessage.Role).
const (
	MessageRoleUser      = "user"
	MessageRoleAssistant = "assistant"
	MessageRoleSystem    = "system"
	MessageRoleSystemErr = "system_error"
	MessageRoleTool      = "tool" // tool-call result, OpenAI protocol; not shown to UI
)

// Assistant/user message content types for rendering.
const (
	MessageContentMarkdown = "markdown"
	MessageContentText     = "text"
	MessageContentJSON     = "json"
)

type ChatSession struct {
	ID                    string        `gorm:"primaryKey;size:36" json:"id"`
	SessionType           string        `gorm:"size:20;default:user_agent;index;not null" json:"session_type"`
	UserID                string        `gorm:"size:36;index" json:"user_id,omitempty"`
	User                  User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	AgentID               string        `gorm:"size:36;index;not null" json:"agent_id"`
	Agent                 Agent         `gorm:"foreignKey:AgentID" json:"agent,omitempty"`
	PeerAgentID           *string       `gorm:"size:36;index" json:"peer_agent_id,omitempty"`
	PeerAgent             *Agent        `gorm:"foreignKey:PeerAgentID" json:"peer_agent,omitempty"`
	IdeaID                *string       `gorm:"size:36;index" json:"idea_id,omitempty"`
	Idea                  *Idea         `gorm:"foreignKey:IdeaID" json:"idea,omitempty"`
	Title                 string        `gorm:"size:500" json:"title"`
	MessageCount          int           `gorm:"default:0" json:"message_count"`
	ForkedFromID          *string       `gorm:"size:36;index" json:"forked_from_id,omitempty"`
	ForkedBeforeMessageID *string       `gorm:"size:36" json:"forked_before_message_id,omitempty"`
	ArchivedAt            *time.Time    `gorm:"index" json:"archived_at,omitempty"`
	CreatedAt             time.Time     `gorm:"index" json:"created_at"`
	UpdatedAt             time.Time     `json:"updated_at"`
	Messages              []ChatMessage `gorm:"foreignKey:SessionID" json:"messages,omitempty"`
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
	ID          string    `gorm:"primaryKey;size:36" json:"id"`
	SessionID   string    `gorm:"size:36;index;not null" json:"session_id"`
	ActorType   string    `gorm:"size:10;index" json:"actor_type"` // user | agent
	ActorID     string    `gorm:"size:36;index" json:"actor_id"`
	Role        string    `gorm:"size:20;not null;index" json:"role"` // user, assistant, system, tool
	ContentType string    `gorm:"size:20;default:markdown" json:"content_type"`
	Content     string    `gorm:"type:text;not null" json:"content"`
	Metadata    string    `gorm:"type:json" json:"metadata,omitempty"`
	CreatedAt   time.Time `gorm:"index" json:"created_at"`
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

// 聊天附件类型。
const (
	AttachmentKindImage    = "image"    // 图片（支持多模态 vision）
	AttachmentKindDocument = "document" // Markdown 文档
)

// ChatAttachment 记录聊天附件的元数据与简述。
//
// 设计目标：消息列表只加载 summary/缩略信息（写在 message.metadata 里），
// 原图/全文仅在发送消息注入对话上下文时按需从 OSS 读取，节省带宽与渲染开销。
type ChatAttachment struct {
	ID          string    `gorm:"primaryKey;size:36" json:"id"`
	UserID      string    `gorm:"size:36;index;not null" json:"user_id"`
	SessionID   string    `gorm:"size:36;index" json:"session_id,omitempty"` // nullable，presign 阶段尚未绑定
	MessageID   string    `gorm:"size:36;index" json:"message_id,omitempty"` // nullable，发送时绑定
	Kind        string    `gorm:"size:16;not null" json:"kind"`              // image | document
	FileName    string    `gorm:"size:255" json:"file_name"`
	ContentType string    `gorm:"size:64;not null" json:"content_type"`
	Size        int64     `gorm:"not null" json:"size"`
	ObjectKey   string    `gorm:"size:500;not null" json:"-"`   // OSS key，不直接暴露
	URL         string    `gorm:"size:500;not null" json:"url"` // public/CDN URL
	Summary     string    `gorm:"type:text" json:"summary"`     // 图片: 占位; 文档: 启发式摘要
	CreatedAt   time.Time `gorm:"index" json:"created_at"`
}

func (a *ChatAttachment) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	return nil
}
