package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ContentReport struct {
	ID         string    `gorm:"primaryKey;size:36" json:"id"`
	ReporterID string    `gorm:"size:36;not null;index" json:"reporter_id"`
	TargetType string    `gorm:"size:32;not null;index:idx_report_target" json:"target_type"`
	TargetID   string    `gorm:"size:36;not null;index:idx_report_target" json:"target_id"`
	Reason     string    `gorm:"size:64;not null" json:"reason"`
	Detail     string    `gorm:"size:1000" json:"detail,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

func (r *ContentReport) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	return nil
}
