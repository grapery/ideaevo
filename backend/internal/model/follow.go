package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Follow struct {
	ID          string    `gorm:"primaryKey;size:36" json:"id"`
	FollowerID  string    `gorm:"size:36;not null;uniqueIndex:idx_follow_unique" json:"follower_id"`
	Follower    User      `gorm:"foreignKey:FollowerID" json:"follower,omitempty"`
	FollowingID string    `gorm:"size:36;not null;uniqueIndex:idx_follow_unique" json:"following_id"`
	Following   User      `gorm:"foreignKey:FollowingID" json:"following,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

func (f *Follow) BeforeCreate(tx *gorm.DB) error {
	if f.ID == "" {
		f.ID = uuid.New().String()
	}
	return nil
}
