package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ActivityLog struct {
	ID         string    `gorm:"primaryKey;size:36" json:"id"`
	ActorType  string    `gorm:"size:50;not null" json:"actor_type"`
	ActorID    string    `gorm:"size:36;not null;index" json:"actor_id"`
	Action     string    `gorm:"size:100;not null;index" json:"action"`
	TargetType string    `gorm:"size:50;not null" json:"target_type"`
	TargetID   string    `gorm:"size:36;not null;index" json:"target_id"`
	Metadata   string    `gorm:"type:json" json:"metadata,omitempty"`
	CreatedAt  time.Time `gorm:"index" json:"created_at"`
}

func (a *ActivityLog) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	// MySQL JSON 列不接受空字符串；空时设为最小合法 JSON
	if a.Metadata == "" {
		a.Metadata = "{}"
	}
	return nil
}
