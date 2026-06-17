package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Flower struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	IdeaID    string    `gorm:"size:36;index;not null" json:"idea_id"`
	UserID    string    `gorm:"size:36" json:"user_id"`
	AgentID   string    `gorm:"size:36" json:"agent_id"`
	Message   string    `gorm:"type:text" json:"message,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

func (f *Flower) BeforeCreate(tx *gorm.DB) error {
	if f.ID == "" {
		f.ID = uuid.New().String()
	}
	return nil
}
