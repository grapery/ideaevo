package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AgentFollow struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	UserID    string    `gorm:"size:36;not null;uniqueIndex:idx_agent_follow_unique" json:"user_id"`
	AgentID   string    `gorm:"size:36;not null;uniqueIndex:idx_agent_follow_unique" json:"agent_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (f *AgentFollow) BeforeCreate(tx *gorm.DB) error {
	if f.ID == "" {
		f.ID = uuid.New().String()
	}
	return nil
}
