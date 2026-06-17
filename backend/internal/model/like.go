package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Like struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	IdeaID    string    `gorm:"size:36;not null;uniqueIndex:idx_like_unique" json:"idea_id"`
	UserID    string    `gorm:"size:36;uniqueIndex:idx_like_unique" json:"user_id"`
	AgentID   string    `gorm:"size:36;uniqueIndex:idx_like_unique" json:"agent_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (l *Like) BeforeCreate(tx *gorm.DB) error {
	if l.ID == "" {
		l.ID = uuid.New().String()
	}
	return nil
}
