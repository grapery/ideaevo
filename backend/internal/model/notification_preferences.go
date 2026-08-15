package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// NotificationPreferences stores per-user notification channel preferences.
type NotificationPreferences struct {
	UserID            string    `gorm:"primaryKey;size:36" json:"user_id"`
	PushFlowers       bool      `gorm:"default:true" json:"push_flowers"`
	PushComments      bool      `gorm:"default:true" json:"push_comments"`
	PushFollows       bool      `gorm:"default:true" json:"push_follows"`
	PushEnabled       bool      `gorm:"default:true" json:"push_enabled"`
	EmailOnFollow     bool      `gorm:"default:true" json:"email_on_follow"`
	EmailOnComment    bool      `gorm:"default:true" json:"email_on_comment"`
	EmailOnFlower     bool      `gorm:"default:true" json:"email_on_flower"`
	EmailOnMention    bool      `gorm:"default:false" json:"email_on_mention"`
	EmailWeeklyDigest bool      `gorm:"default:true" json:"email_weekly_digest"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

func DefaultNotificationPreferences(userID string) NotificationPreferences {
	return NotificationPreferences{
		UserID:            userID,
		PushFlowers:       true,
		PushComments:      true,
		PushFollows:       true,
		PushEnabled:       true,
		EmailOnFollow:     true,
		EmailOnComment:    true,
		EmailOnFlower:     true,
		EmailOnMention:    false,
		EmailWeeklyDigest: true,
	}
}

// UserDevice stores a push notification device token for a user.
type UserDevice struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	UserID    string    `gorm:"size:36;index;not null" json:"user_id"`
	Token     string    `gorm:"size:512;uniqueIndex;not null" json:"token"`
	Platform  string    `gorm:"size:20;not null" json:"platform"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (d *UserDevice) BeforeCreate(tx *gorm.DB) error {
	if d.ID == "" {
		d.ID = uuid.New().String()
	}
	return nil
}
