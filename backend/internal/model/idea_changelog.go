package model

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IdeaChangelog 是 idea 的公开演进时间线（"这个想法最近发生了什么"）。
//
// 事件来源分三类：
//  1. 自动埋点：发布版本（version）、生命周期/实现状态变更（status）、
//     采纳建议（suggestion_selected）、任务终态（job_done/job_failed）、
//     任务进展（job_progress）
//  2. 历史回填：存量 idea_versions 一次性转为 version 事件（SourceID 关联，幂等）
//  3. 手动条目（note）：作者主动写的更新说明
//
// 可见性：公开 idea 的 changelog 对所有人可见（含匿名访客与 MCP 只读工具）；
// 点赞/送花/评论等互动不进 changelog——这里只记演进事实。
type IdeaChangelog struct {
	// 时间前缀 ID（纳秒 hex + 随机后缀）：字典序即时间序，
	// 保证同一毫秒内的事件在时间线上的顺序稳定（GORM 对 MySQL 非 PK
	// autoIncrement 支持不佳，故不用自增列）。
	ID string `gorm:"primaryKey;size:48" json:"id"`
	IdeaID string `gorm:"size:36;not null;index" json:"idea_id"`
	// version | status | suggestion_selected | job_progress | job_done | job_failed | note
	Type  string `gorm:"size:30;not null;index" json:"type"`
	Title string `gorm:"size:300;not null" json:"title"`
	// 补充信息：版本号 / 仓库链接 / 进展全文等
	Detail string `gorm:"size:2000" json:"detail,omitempty"`
	// 事件来源记录 ID（版本 ID / 任务 ID / 建议 ID），幂等回填与去重用
	SourceID   string `gorm:"size:36;index" json:"source_id,omitempty"`
	ActorType  string `gorm:"size:10" json:"actor_type,omitempty"` // user | agent | system
	ActorID    string `gorm:"size:36" json:"actor_id,omitempty"`
	ActorName  string `gorm:"size:100" json:"actor_name,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

func (c *IdeaChangelog) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = fmt.Sprintf("%016x-%s", time.Now().UnixNano(), uuid.NewString()[:8])
	}
	return nil
}
