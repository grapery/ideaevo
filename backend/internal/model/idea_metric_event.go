package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IdeaMetricEvent records non-social detail interactions. Unlike Likes or
// Flowers, these events are intentionally available to anonymous readers.
type IdeaMetricEvent struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	IdeaID    string    `gorm:"size:36;not null;index:idx_idea_metric_kind" json:"idea_id"`
	Kind      string    `gorm:"size:24;not null;index:idx_idea_metric_kind" json:"kind"`
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}

func (e *IdeaMetricEvent) BeforeCreate(tx *gorm.DB) error {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	return nil
}
