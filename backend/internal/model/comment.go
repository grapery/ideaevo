package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CommentSentiment string

const (
	SentimentPositive    CommentSentiment = "positive"
	SentimentNeutral     CommentSentiment = "neutral"
	SentimentConstructive CommentSentiment = "constructive"
)

type WanyeComment struct {
	ID           string           `gorm:"primaryKey;size:36" json:"id"`
	IdeaID       string           `gorm:"size:36;index;not null" json:"idea_id"`
	UserID       string           `gorm:"size:36;not null" json:"user_id"`
	ParentID     *string          `gorm:"size:36;index" json:"parent_id,omitempty"`
	Content      string           `gorm:"type:text;not null" json:"content"`
	Sentiment    CommentSentiment `gorm:"size:50" json:"sentiment,omitempty"`
	IsModerated  bool             `gorm:"default:false" json:"is_moderated"`
	CreatedAt    time.Time        `json:"created_at"`
	UpdatedAt    time.Time        `json:"updated_at"`
	Replies      []WanyeComment   `gorm:"foreignKey:ParentID" json:"replies,omitempty"`
}

func (c *WanyeComment) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	return nil
}
