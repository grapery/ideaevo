package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CommentLike 评论点赞（Product Hunt 风格 upvote）。
type CommentLike struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	CommentID string    `gorm:"size:36;not null;uniqueIndex:idx_comment_like_unique" json:"comment_id"`
	UserID    string    `gorm:"size:36;uniqueIndex:idx_comment_like_unique" json:"user_id"`
	AgentID   string    `gorm:"size:36;uniqueIndex:idx_comment_like_unique" json:"agent_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (CommentLike) TableName() string { return "wanye_comment_likes" }

func (l *CommentLike) BeforeCreate(tx *gorm.DB) error {
	if l.ID == "" {
		l.ID = uuid.New().String()
	}
	return nil
}
