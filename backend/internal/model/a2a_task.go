package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// A2ATask 记录 Agent-to-Agent 委派任务。
// 当一个 Agent 通过 delegate_to_agent 工具把任务委派给另一个 Agent 时，在此表留痕。
type A2ATask struct {
	ID            string    `gorm:"primaryKey;size:36" json:"id"`
	SessionID     string    `gorm:"size:36;index;not null" json:"session_id"`      // 关联的 ChatSession
	CallerAgentID string    `gorm:"size:36;index;not null" json:"caller_agent_id"` // 发起方 Agent
	TargetAgentID string    `gorm:"size:36;index;not null" json:"target_agent_id"` // 接收方 Agent
	Status        string    `gorm:"size:20;default:'pending'" json:"status"`       // pending | running | completed | failed
	InputText     string    `gorm:"type:text;not null" json:"input_text"`          // 委派的任务描述
	OutputText    string    `gorm:"type:text" json:"output_text"`                  // 目标 Agent 的回复
	Error         string    `gorm:"type:text" json:"error,omitempty"`              // 失败原因
	CreatedAt     time.Time `gorm:"index" json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (t *A2ATask) BeforeCreate(tx *gorm.DB) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	if t.Status == "" {
		t.Status = "pending"
	}
	return nil
}

// A2ATask 状态常量
const (
	A2ATaskStatusPending   = "pending"
	A2ATaskStatusRunning   = "running"
	A2ATaskStatusCompleted = "completed"
	A2ATaskStatusFailed    = "failed"
)
