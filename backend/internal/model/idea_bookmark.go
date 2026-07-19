package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IdeaBookmark is a private user library entry for an Idea.
type IdeaBookmark struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	IdeaID    string    `gorm:"size:36;not null;uniqueIndex:idx_idea_bookmark_user" json:"idea_id"`
	UserID    string    `gorm:"size:36;not null;uniqueIndex:idx_idea_bookmark_user" json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (b *IdeaBookmark) BeforeCreate(tx *gorm.DB) error {
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	return nil
}
