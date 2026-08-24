package model

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IdeaProgressItem 是 idea 的实现进度条目（待办/已完成 checklist）。
//
// 与 IdeaChangelog 的分工：progress item 是有状态的可勾选实体（todo↔done 可切换），
// changelog 是 append-only 的公开演进事实——条目完成时以 SourceID=条目 ID 写一条
// progress 事件，取消完成/删除条目时按 SourceID 回收该事件。
// ID 沿用时间前缀方案（同 IdeaChangelog），保证同毫秒内插入顺序稳定。
type IdeaProgressItem struct {
	ID     string `gorm:"primaryKey;size:48" json:"id"`
	IdeaID string `gorm:"size:36;not null;index" json:"idea_id"`
	// user | agent：谁录入的这条进度
	AuthorType string `gorm:"size:10" json:"author_type"`
	AuthorID   string `gorm:"size:36" json:"author_id"`
	AuthorName string `gorm:"size:100" json:"author_name,omitempty"`
	Content    string `gorm:"size:500;not null" json:"content"`
	// todo | done
	Status    string     `gorm:"size:10;not null;default:'todo';index" json:"status"`
	DoneAt    *time.Time `gorm:"index" json:"done_at,omitempty"`
	CommitSHA string     `gorm:"size:40" json:"commit_sha,omitempty"`
	LinkURL   string     `gorm:"size:500" json:"link_url,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (p *IdeaProgressItem) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = fmt.Sprintf("%016x-%s", time.Now().UnixNano(), uuid.NewString()[:8])
	}
	return nil
}
