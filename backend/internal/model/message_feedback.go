package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	MessageFeedbackLike    = "like"
	MessageFeedbackDislike = "dislike"
)

type MessageFeedback struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	MessageID string    `gorm:"size:36;not null;uniqueIndex:idx_msg_feedback_user" json:"message_id"`
	UserID    string    `gorm:"size:36;not null;uniqueIndex:idx_msg_feedback_user" json:"user_id"`
	Rating    string    `gorm:"size:10;not null" json:"rating"` // like | dislike
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (f *MessageFeedback) BeforeCreate(tx *gorm.DB) error {
	if f.ID == "" {
		f.ID = uuid.New().String()
	}
	return nil
}
