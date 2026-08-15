package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserBlock struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	BlockerID string    `gorm:"size:36;not null;uniqueIndex:idx_user_block_unique" json:"blocker_id"`
	BlockedID string    `gorm:"size:36;not null;uniqueIndex:idx_user_block_unique" json:"blocked_id"`
	Blocked   User      `gorm:"foreignKey:BlockedID" json:"blocked,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

func (b *UserBlock) BeforeCreate(tx *gorm.DB) error {
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	return nil
}
