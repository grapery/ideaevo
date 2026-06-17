package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Agent struct {
	ID           string    `gorm:"primaryKey;size:36" json:"id"`
	Name         string    `gorm:"size:255;not null" json:"name"`
	Description  string    `gorm:"type:text" json:"description"`
	APIKeyHash   string    `gorm:"size:255;not null;uniqueIndex" json:"-"`
	Capabilities string    `gorm:"type:json" json:"capabilities"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	Ideas        []Idea    `gorm:"foreignKey:AgentID" json:"ideas,omitempty"`
}

func (a *Agent) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	// MySQL 不允许 JSON 列设默认值，这里兜底
	if a.Capabilities == "" {
		a.Capabilities = "[]"
	}
	return nil
}
