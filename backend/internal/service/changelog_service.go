package service

// changelog_service.go —— idea 公开演进时间线的写入与查询。
//
// WriteChangelog 是唯一写入口：接受 tx（可处于外层事务中），
// 各服务在状态变更的同一事务里调用，保证事件与业务变更原子落库。
// 失败仅记录，不阻断业务（时间线是附属信息，不应拖垮主流程）。

import (
	"fmt"
	"log"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// Changelog 事件类型常量。
const (
	ChangelogTypeVersion            = "version"
	ChangelogTypeStatus             = "status"
	ChangelogTypeSuggestionSelected = "suggestion_selected"
	ChangelogTypeJobProgress        = "job_progress"
	ChangelogTypeJobDone            = "job_done"
	ChangelogTypeJobFailed          = "job_failed"
	ChangelogTypeNote               = "note"
)

// ChangelogView 是公开列表的条目视图。
type ChangelogView struct {
	ID         string    `json:"id"`
	Type       string    `json:"type"`
	Title      string    `json:"title"`
	Detail     string    `json:"detail,omitempty"`
	ActorType  string    `json:"actor_type,omitempty"`
	ActorName  string    `json:"actor_name,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

// WriteChangelog 在当前事务中追加一条事件；失败不影响主流程。
func WriteChangelog(tx *gorm.DB, ideaID, typ, title, detail, sourceID, actorType, actorID, actorName string) {
	if ideaID == "" || title == "" {
		return
	}
	if len(title) > 300 {
		title = title[:300]
	}
	if len(detail) > 2000 {
		detail = detail[:2000]
	}
	entry := &model.IdeaChangelog{
		IdeaID: ideaID, Type: typ, Title: title, Detail: detail,
		SourceID: sourceID, ActorType: actorType, ActorID: actorID, ActorName: actorName,
	}
	if err := tx.Create(entry).Error; err != nil {
		log.Printf("changelog write failed (idea=%s type=%s): %v", ideaID, typ, err)
	}
}

// WriteChangelogAt 同上，但指定事件时间（历史回填用）。
func WriteChangelogAt(tx *gorm.DB, ideaID, typ, title, detail, sourceID, actorType, actorID, actorName string, at time.Time) {
	if ideaID == "" || title == "" {
		return
	}
	entry := &model.IdeaChangelog{
		IdeaID: ideaID, Type: typ, Title: title, Detail: detail,
		SourceID: sourceID, ActorType: actorType, ActorID: actorID, ActorName: actorName,
		CreatedAt: at,
	}
	if err := tx.Create(entry).Error; err != nil {
		log.Printf("changelog backfill failed (idea=%s type=%s): %v", ideaID, typ, err)
	}
}

// ListChangelog 返回某 idea 的公开时间线（新事件在前）。
func ListChangelog(db *gorm.DB, ideaID string, limit int) ([]ChangelogView, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	var rows []model.IdeaChangelog
	if err := db.Where("idea_id = ?", ideaID).
		// created_at 为主（回填事件的历史时间戳优先），时间前缀 ID 只做
		// 同毫秒内的平局裁决（其字典序=插入序）。
		Order("created_at DESC, id DESC").Limit(limit).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]ChangelogView, len(rows))
	for i, r := range rows {
		out[i] = ChangelogView{
			ID: r.ID, Type: r.Type, Title: r.Title, Detail: r.Detail,
			ActorType: r.ActorType, ActorName: r.ActorName, CreatedAt: r.CreatedAt,
		}
	}
	return out, nil
}

// BackfillVersionEvents 把存量 idea_versions 幂等转为 version 事件
// （SourceID 记版本 ID，重复执行自动跳过）。API 启动时调用一次。
// 同时修复两类历史脏数据：EnsureVersions 并发竞态产生的重复版本行
// （同 idea 同版本号取最早一条）、指向已删版本的孤儿事件。
func BackfillVersionEvents(db *gorm.DB) (int64, error) {
	// 孤儿事件清理（版本行已被去重删除时，其事件残留）
	if err := db.Exec(`DELETE c FROM idea_changelogs c
		LEFT JOIN idea_versions v ON v.id = c.source_id
		WHERE c.type = ? AND c.source_id <> '' AND v.id IS NULL`, ChangelogTypeVersion).Error; err != nil {
		return 0, err
	}
	var versions []model.IdeaVersion
	if err := db.Where("id NOT IN (?) AND id IN (?)",
		db.Model(&model.IdeaChangelog{}).Select("source_id").
			Where("type = ? AND source_id <> ''", ChangelogTypeVersion),
		db.Model(&model.IdeaVersion{}).Select("MIN(id)").
			Group("idea_id, version"),
	).Find(&versions).Error; err != nil {
		return 0, err
	}
	if len(versions) == 0 {
		return 0, nil
	}
	return int64(len(versions)), db.Transaction(func(tx *gorm.DB) error {
		for _, v := range versions {
			title := v.Changelog
			if title == "" {
				title = fmt.Sprintf("v%d", v.Version)
			}
			WriteChangelogAt(tx, v.IdeaID, ChangelogTypeVersion, title,
				fmt.Sprintf("v%d", v.Version), v.ID, "system", "", "", v.CreatedAt)
		}
		return nil
	})
}

// ListIdeaChangelog 是 IdeaService 的包装（handler 用）。
func (s *IdeaService) ListIdeaChangelog(ideaID string, limit int) ([]ChangelogView, error) {
	return ListChangelog(s.db, ideaID, limit)
}
