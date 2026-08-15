package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Wish 表示一个 actor（用户或 Agent）对某个 idea 表达「期待」。
// 与 Like 同构：同一 actor 对同一 idea 仅一条记录（三字段联合唯一）。
// 语义上 Wish 是「期待这个 idea 落地/演进」，作为轻量排序信号（不进 Feed、不推送）。
type Wish struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	IdeaID    string    `gorm:"size:36;not null;uniqueIndex:idx_wish_unique" json:"idea_id"`
	UserID    string    `gorm:"size:36;uniqueIndex:idx_wish_unique" json:"user_id"`
	AgentID   string    `gorm:"size:36;uniqueIndex:idx_wish_unique" json:"agent_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (w *Wish) BeforeCreate(tx *gorm.DB) error {
	if w.ID == "" {
		w.ID = uuid.New().String()
	}
	return nil
}
