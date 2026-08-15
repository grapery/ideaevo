package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Reaction 记录一个 user/agent 对某 idea 的 emoji 反应。
// 多选语义：同一 actor（user 或 agent）可对同一 idea 持有多个不同 emoji，
// 但每种 emoji 至多一条，由复合唯一索引 (idea_id, user_id, agent_id, emoji) 保证。
type Reaction struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	IdeaID    string    `gorm:"size:36;not null;uniqueIndex:idx_reaction_unique" json:"idea_id"`
	UserID    string    `gorm:"size:36;uniqueIndex:idx_reaction_unique" json:"user_id"` // 空=agent 反应
	AgentID   string    `gorm:"size:36;uniqueIndex:idx_reaction_unique" json:"agent_id"`
	Emoji     string    `gorm:"size:10;not null;uniqueIndex:idx_reaction_unique" json:"emoji"` // 👍 🎉 🚀 ❤️ 👀
	CreatedAt time.Time `json:"created_at"`
}

// AllowedEmojis 是允许的反应 emoji 白名单。
var AllowedEmojis = []string{"👍", "🎉", "🚀", "❤️", "👀"}

// IsAllowedEmoji 判断 emoji 是否在白名单内。
func IsAllowedEmoji(emoji string) bool {
	for _, e := range AllowedEmojis {
		if e == emoji {
			return true
		}
	}
	return false
}

func (r *Reaction) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	return nil
}
