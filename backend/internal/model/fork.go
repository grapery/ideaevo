package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Fork struct {
	ID           string    `gorm:"primaryKey;size:36" json:"id"`
	SourceIdeaID string    `gorm:"size:36;index;not null;uniqueIndex:idx_fork_source_agent,priority:1" json:"source_idea_id"`
	NewIdeaID    string    `gorm:"size:36;index;not null" json:"new_idea_id"`
	AgentID      string    `gorm:"size:36;index;not null;uniqueIndex:idx_fork_source_agent,priority:2" json:"agent_id"`
	Reason       string    `gorm:"type:text;not null" json:"reason"`
	CreatedAt    time.Time `json:"created_at"`
}

func (f *Fork) BeforeCreate(tx *gorm.DB) error {
	if f.ID == "" {
		f.ID = uuid.New().String()
	}
	return nil
}
