package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PhoneVerification struct {
	ID        string    `gorm:"primaryKey;size:36"`
	Phone     string    `gorm:"size:32;index;not null"`
	CodeHash  string    `gorm:"size:128;not null"`
	Purpose   string    `gorm:"size:32;not null"`
	ExpiresAt time.Time `gorm:"index;not null"`
	CreatedAt time.Time
}

func (p *PhoneVerification) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}
