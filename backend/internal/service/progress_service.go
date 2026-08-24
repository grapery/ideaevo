package service

// progress_service.go —— idea 实现进度条目（待办/已完成 checklist）的读写。
//
// 写操作与公开 changelog 联动：条目完成（创建即 done，或 todo→done）写一条
// progress 事件（SourceID=条目 ID），取消完成/删除条目时按 SourceID 回收事件，
// 保证演进时间线不残留失实条目。首次录入任意条目时，若 idea 还停在构想阶段
// （impl_status 为空或 concept），自动升级为 in_progress。

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

const (
	ProgressStatusTodo = "todo"
	ProgressStatusDone = "done"
)

var commitSHARe = regexp.MustCompile(`^[0-9a-fA-F]{7,40}$`)

// ProgressActor 记录进度条目的录入者（网页用户或 Agent）。
type ProgressActor struct {
	Type string // "user" | "agent"
	ID   string
	Name string
}

// ProgressItemInput 创建条目的入参（Status 为空按 todo 处理）。
type ProgressItemInput struct {
	Content   string `json:"content"`
	Status    string `json:"status"`
	CommitSHA string `json:"commit_sha"`
	LinkURL   string `json:"link_url"`
}

// ProgressItemUpsert 带 ID 的条目即为更新该条，否则新建。
type ProgressItemUpsert struct {
	ID    string
	Input ProgressItemInput
}

// ProgressUpdateInput 单条 PATCH：指针为 nil 表示跳过该字段。
type ProgressUpdateInput struct {
	Content   *string `json:"content"`
	Status    *string `json:"status"`
	CommitSHA *string `json:"commit_sha"`
	LinkURL   *string `json:"link_url"`
}

// ProgressListView 面板直接可用的分组视图：待办按创建序，已完成按完成时间倒序。
type ProgressListView struct {
	Todos []model.IdeaProgressItem `json:"todos"`
	Dones []model.IdeaProgressItem `json:"dones"`
}

type ProgressService struct {
	db *gorm.DB
}

func NewProgressService(db *gorm.DB) *ProgressService {
	return &ProgressService{db: db}
}

func validateProgressContent(raw string) (string, error) {
	content := strings.TrimSpace(raw)
	if content == "" {
		return "", fmt.Errorf("content 不能为空")
	}
	if len([]rune(content)) > 500 {
		return "", fmt.Errorf("content 过长（最多 500 字）")
	}
	return content, nil
}

func normalizeCommitSHA(raw string) (string, error) {
	sha := strings.TrimSpace(strings.ToLower(raw))
	if sha == "" {
		return "", nil
	}
	if !commitSHARe.MatchString(sha) {
		return "", fmt.Errorf("commit_sha 只允许 7-40 位十六进制字符")
	}
	return sha, nil
}

func normalizeProgressLink(raw string) (string, error) {
	link := strings.TrimSpace(raw)
	if link == "" {
		return "", nil
	}
	if err := validateHTTPURL(link); err != nil {
		return "", err
	}
	return link, nil
}

// List 公开读取某 idea 的进度条目分组视图。
func (s *ProgressService) List(ideaID string) (*ProgressListView, error) {
	view := &ProgressListView{
		Todos: []model.IdeaProgressItem{},
		Dones: []model.IdeaProgressItem{},
	}
	if err := s.db.Where("idea_id = ? AND status = ?", ideaID, ProgressStatusTodo).
		Order("created_at ASC, id ASC").Find(&view.Todos).Error; err != nil {
		return nil, err
	}
	if err := s.db.Where("idea_id = ? AND status = ?", ideaID, ProgressStatusDone).
		Order("done_at DESC, id DESC").Find(&view.Dones).Error; err != nil {
		return nil, err
	}
	return view, nil
}

// UpsertItems 批量新建/更新进度条目（MCP report_progress 与 REST POST 共用）。
func (s *ProgressService) UpsertItems(ideaID string, upserts []ProgressItemUpsert, actor ProgressActor) (*ProgressListView, error) {
	if len(upserts) == 0 {
		return nil, fmt.Errorf("items 不能为空")
	}
	var idea model.Idea
	if err := s.db.First(&idea, "id = ?", ideaID).Error; err != nil {
		return nil, err
	}

	// 先整体校验，避免半截写入
	type plannedItem struct {
		exists *model.IdeaProgressItem
		next   model.IdeaProgressItem
	}
	planned := make([]plannedItem, 0, len(upserts))
	created := false
	for _, up := range upserts {
		content, err := validateProgressContent(up.Input.Content)
		if err != nil {
			return nil, err
		}
		commit, err := normalizeCommitSHA(up.Input.CommitSHA)
		if err != nil {
			return nil, err
		}
		link, err := normalizeProgressLink(up.Input.LinkURL)
		if err != nil {
			return nil, err
		}
		status := strings.TrimSpace(up.Input.Status)
		if status != "" && status != ProgressStatusTodo && status != ProgressStatusDone {
			return nil, fmt.Errorf("status 只能是 todo 或 done")
		}

		if up.ID != "" {
			var existing model.IdeaProgressItem
			if err := s.db.First(&existing, "id = ? AND idea_id = ?", up.ID, ideaID).Error; err != nil {
				return nil, fmt.Errorf("progress item not found: %s", up.ID)
			}
			if status == "" {
				// 更新时未传 status = 保持原状态
				status = existing.Status
			}
			next := existing
			next.Content, next.CommitSHA, next.LinkURL, next.Status = content, commit, link, status
			planned = append(planned, plannedItem{exists: &existing, next: next})
		} else {
			if status == "" {
				status = ProgressStatusTodo
			}
			item := model.IdeaProgressItem{
				IdeaID: ideaID, AuthorType: actor.Type, AuthorID: actor.ID, AuthorName: actor.Name,
				Content: content, Status: status, CommitSHA: commit, LinkURL: link,
			}
			planned = append(planned, plannedItem{next: item})
			created = true
		}
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		for _, p := range planned {
			if p.next.Status == ProgressStatusDone && p.next.DoneAt == nil {
				now := time.Now()
				p.next.DoneAt = &now
			}
			if p.next.Status == ProgressStatusTodo {
				p.next.DoneAt = nil
			}
			if p.exists != nil {
				if err := tx.Model(&model.IdeaProgressItem{}).Where("id = ?", p.next.ID).
					Updates(map[string]any{
						"content": p.next.Content, "status": p.next.Status,
						"commit_sha": p.next.CommitSHA, "link_url": p.next.LinkURL,
						"done_at": p.next.DoneAt,
					}).Error; err != nil {
					return err
				}
			} else {
				if err := tx.Create(&p.next).Error; err != nil {
					return err
				}
			}
			writeProgressEvent(tx, &p.next, p.exists, actor)
		}
		if created {
			ensureImplInProgress(tx, &idea)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.List(ideaID)
}

// UpdateItem 单条更新（内容/证据字段/勾选状态切换）。
func (s *ProgressService) UpdateItem(ideaID, itemID string, in ProgressUpdateInput, actor ProgressActor) (*model.IdeaProgressItem, error) {
	var item model.IdeaProgressItem
	if err := s.db.First(&item, "id = ? AND idea_id = ?", itemID, ideaID).Error; err != nil {
		return nil, err
	}

	next := item
	if in.Content != nil {
		content, err := validateProgressContent(*in.Content)
		if err != nil {
			return nil, err
		}
		next.Content = content
	}
	if in.CommitSHA != nil {
		commit, err := normalizeCommitSHA(*in.CommitSHA)
		if err != nil {
			return nil, err
		}
		next.CommitSHA = commit
	}
	if in.LinkURL != nil {
		link, err := normalizeProgressLink(*in.LinkURL)
		if err != nil {
			return nil, err
		}
		next.LinkURL = link
	}
	if in.Status != nil {
		status := strings.TrimSpace(*in.Status)
		if status != ProgressStatusTodo && status != ProgressStatusDone {
			return nil, fmt.Errorf("status 只能是 todo 或 done")
		}
		next.Status = status
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if next.Status == ProgressStatusDone && next.DoneAt == nil {
			now := time.Now()
			next.DoneAt = &now
		}
		if next.Status != ProgressStatusDone {
			next.DoneAt = nil
		}
		if err := tx.Model(&model.IdeaProgressItem{}).Where("id = ?", next.ID).
			Updates(map[string]any{
				"content": next.Content, "status": next.Status,
				"commit_sha": next.CommitSHA, "link_url": next.LinkURL,
				"done_at": next.DoneAt,
			}).Error; err != nil {
			return err
		}
		writeProgressEvent(tx, &next, &item, actor)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &next, nil
}

// DeleteItem 删除条目并回收其 changelog 事件。
func (s *ProgressService) DeleteItem(ideaID, itemID string) error {
	var item model.IdeaProgressItem
	if err := s.db.First(&item, "id = ? AND idea_id = ?", itemID, ideaID).Error; err != nil {
		return err
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&model.IdeaProgressItem{}, "id = ?", item.ID).Error; err != nil {
			return err
		}
		removeProgressEvents(tx, item.ID)
		return nil
	})
}

// writeProgressEvent 按 todo↔done 迁移方向同步 changelog：
// 进入 done 写事件，离开 done 回收事件；其余变更不动事件（保留完成时刻的原文）。
func writeProgressEvent(tx *gorm.DB, next *model.IdeaProgressItem, prev *model.IdeaProgressItem, actor ProgressActor) {
	prevDone := prev != nil && prev.Status == ProgressStatusDone
	nowDone := next.Status == ProgressStatusDone
	switch {
	case !prevDone && nowDone:
		WriteChangelog(tx, next.IdeaID, ChangelogTypeProgress, next.Content,
			joinProgressDetail(next), next.ID, actor.Type, actor.ID, actor.Name)
		logActivity(tx, actor.Type, actor.ID, ActionUpdateImpl, "idea", next.IdeaID,
			map[string]string{"progress": next.Content})
	case prevDone && !nowDone:
		removeProgressEvents(tx, next.ID)
	}
}

func removeProgressEvents(tx *gorm.DB, itemID string) {
	tx.Where("type = ? AND source_id = ?", ChangelogTypeProgress, itemID).
		Delete(&model.IdeaChangelog{})
}

func joinProgressDetail(item *model.IdeaProgressItem) string {
	parts := make([]string, 0, 2)
	if item.CommitSHA != "" {
		parts = append(parts, "commit "+item.CommitSHA)
	}
	if item.LinkURL != "" {
		parts = append(parts, item.LinkURL)
	}
	return strings.Join(parts, " · ")
}

// ensureImplInProgress 首次录入进度时把构想期 idea 升为实现中。
func ensureImplInProgress(tx *gorm.DB, idea *model.Idea) {
	if idea.ImplStatus != "" && idea.ImplStatus != model.ImplStatusConcept {
		return
	}
	if err := tx.Model(&model.Idea{}).Where("id = ?", idea.ID).
		Update("impl_status", model.ImplStatusInProgress).Error; err != nil {
		// 升级失败不阻断进度写入（与 changelog 同样的附属语义）
		return
	}
}
