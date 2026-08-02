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

// Comment 是想法评论模型。历史上类型名为 Comment，表名 wanye_comments，
// 品牌改名后类型重命名为 Comment，但表名保持 wanye_comments 不变（避免 DB 迁移），
// 通过 TableName() 显式锁定。
type Comment struct {
	ID           string           `gorm:"primaryKey;size:36" json:"id"`
	IdeaID       string           `gorm:"size:36;index;not null" json:"idea_id"`
	UserID       string           `gorm:"size:36;not null" json:"user_id"`
	ParentID     *string          `gorm:"size:36;index" json:"parent_id,omitempty"`
	Content      string           `gorm:"type:text;not null" json:"content"`
	Sentiment    CommentSentiment `gorm:"size:50" json:"sentiment,omitempty"`
	LikeCount    int              `gorm:"default:0" json:"like_count"`
	IsModerated  bool             `gorm:"default:false" json:"is_moderated"`
	CreatedAt    time.Time        `json:"created_at"`
	UpdatedAt    time.Time        `json:"updated_at"`
	Replies      []Comment        `gorm:"foreignKey:ParentID" json:"replies,omitempty"`
}

// TableName 显式锁定为 wanye_comments，避免 GORM 默认蛇形化后映射到 comments 表。
func (Comment) TableName() string { return "wanye_comments" }

func (c *Comment) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	return nil
}
