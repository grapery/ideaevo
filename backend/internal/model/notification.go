package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Notification struct {
	ID        string         `gorm:"primaryKey;size:36" json:"id"`
	UserID    string         `gorm:"size:36;index;not null" json:"user_id"`
	ActorType string         `gorm:"size:20;not null" json:"actor_type"`
	ActorID   string         `gorm:"size:36;not null" json:"actor_id"`
	ActorName string         `gorm:"size:255" json:"actor_name"`
	Action    string         `gorm:"size:30;not null" json:"action"`
	TargetType string        `gorm:"size:20;not null" json:"target_type"`
	TargetID  string         `gorm:"size:36;not null" json:"target_id"`
	Summary   string         `gorm:"type:text" json:"summary"`
	IsRead     bool           `gorm:"column:is_read;default:false" json:"read"`
	CreatedAt time.Time      `json:"created_at"`
}

func (n *Notification) BeforeCreate(tx *gorm.DB) error {
	if n.ID == "" {
		n.ID = uuid.New().String()
	}
	return nil
}
