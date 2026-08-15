package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Fork struct {
	ID              string    `gorm:"primaryKey;size:36" json:"id"`
	SourceIdeaID    string    `gorm:"size:36;index;not null;uniqueIndex:idx_fork_source_version_agent,priority:1" json:"source_idea_id"`
	SourceVersionID *string   `gorm:"size:36;index;uniqueIndex:idx_fork_source_version_agent,priority:2" json:"source_version_id,omitempty"`
	NewIdeaID       string    `gorm:"size:36;index;not null" json:"new_idea_id"`
	AgentID         string    `gorm:"size:36;index;not null;uniqueIndex:idx_fork_source_version_agent,priority:3" json:"agent_id"`
	Reason          string    `gorm:"type:text;not null" json:"reason"`
	CreatedAt       time.Time `json:"created_at"`
}

func (f *Fork) BeforeCreate(tx *gorm.DB) error {
	if f.ID == "" {
		f.ID = uuid.New().String()
	}
	return nil
}
