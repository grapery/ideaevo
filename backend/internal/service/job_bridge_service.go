package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ---- 本地编码 Agent 桥（L0：MCP 工具直接操作任务队列）----
//
// 设计：用户把 Deimos MCP 注册进本地的 Claude Code / Codex / ZCode 后，
// 编码 Agent 通过 claim_next_job / send_progress / ask_user / report_job_result
// 四个工具完成「领取 → 推进 → 提问 → 回报」闭环。身份解析沿用
// resolvePrincipalUser（登录用户优先，否则 Agent 的 owner）。

// JobSpecView 是交给本地 Agent 的任务规格。
type JobSpecView struct {
	JobID       string `json:"job_id"`
	IdeaID      string `json:"idea_id"`
	Status      string `json:"status"`
	IdeaTitle   string `json:"idea_title"`
	IdeaDesc    string `json:"idea_desc"`
	IdeaRepoURL string `json:"idea_repo_url,omitempty"`
	IdeaTags    string `json:"idea_tags,omitempty"`
	// 采纳的建议内容（本任务要实现的需求）
	SuggestionContent string    `json:"suggestion_content,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	// 以下仅在 get_job_spec 重读时填充（claim 时为空）
	Progress  []JobProgressNoteView `json:"progress,omitempty"`
	Questions []JobQuestionSpecView `json:"questions,omitempty"`
}

// ClaimNextJob 原子领取该用户的下一个 pending 任务（pending → in_progress）。
// FOR UPDATE + 条件更新防并发双抢；无任务时返回 nil（不是错误）。
func (s *SuggestionService) ClaimNextJob(ownerUserID string) (*JobSpecView, error) {
	var job model.ImplementationJob
	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("owner_user_id = ? AND status = ?", ownerUserID, "pending").
			Order("created_at ASC").First(&job).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		return tx.Model(&job).Where("status = ?", "pending").
			Update("status", "in_progress").Error
	})
	if err != nil {
		return nil, err
	}
	if job.ID == "" {
		return nil, nil
	}
	return s.buildJobSpec(&job)
}

// buildJobSpec 用 idea 当前快照 + 简报组装任务规格。
func (s *SuggestionService) buildJobSpec(job *model.ImplementationJob) (*JobSpecView, error) {
	view := &JobSpecView{
		JobID: job.ID, IdeaID: job.IdeaID, Status: job.Status,
		CreatedAt: job.CreatedAt,
	}
	var idea model.Idea
	if err := s.db.Where("id = ?", job.IdeaID).First(&idea).Error; err == nil {
		view.IdeaTitle = idea.Title
		view.IdeaDesc = idea.Description
		view.IdeaRepoURL = idea.RepoURL
		view.IdeaTags = idea.Tags
	}
	var brief struct {
		SuggestionContent string `json:"suggestion_content"`
	}
	_ = json.Unmarshal([]byte(job.Brief), &brief)
	view.SuggestionContent = brief.SuggestionContent
	return view, nil
}

// JobQuestionSpecView 是规格里附带的历史问答（含已回答）。
type JobQuestionSpecView struct {
	Question  string    `json:"question"`
	Answer    string    `json:"answer,omitempty"`
	Answered  bool      `json:"answered"`
	CreatedAt time.Time `json:"created_at"`
}

// GetJobSpec 重读某个任务的完整规格（含进展与问答历史），
// 供本地 Agent 会话崩溃后重建上下文、或分阶段实现时续接。
func (s *SuggestionService) GetJobSpec(jobID, ownerUserID string) (*JobSpecView, error) {
	var job model.ImplementationJob
	if err := s.db.Where("id = ?", jobID).First(&job).Error; err != nil {
		return nil, ErrSuggestionJobNotFound
	}
	if job.OwnerUserID != ownerUserID {
		return nil, ErrSuggestionJobNotOwner
	}
	view, err := s.buildJobSpec(&job)
	if err != nil {
		return nil, err
	}
	var notes []JobProgressNoteView
	_ = json.Unmarshal([]byte(job.ProgressLog), &notes)
	if len(notes) > 0 {
		view.Progress = notes
	}
	var questions []model.JobQuestion
	if err := s.db.Where("job_id = ?", jobID).Order("created_at ASC").Limit(20).Find(&questions).Error; err == nil && len(questions) > 0 {
		view.Questions = make([]JobQuestionSpecView, 0, len(questions))
		for _, q := range questions {
			view.Questions = append(view.Questions, JobQuestionSpecView{
				Question: q.Question, Answer: q.Answer,
				Answered: q.AnsweredAt != nil, CreatedAt: q.CreatedAt,
			})
		}
	}
	return view, nil
}

// progressNote 是 ProgressLog JSON 数组的元素。
type progressNote struct {
	Note string    `json:"note"`
	At   time.Time `json:"at"`
}

// AppendProgress 由 send_progress 调用：追加一条阶段性说明（保留最近 50 条）。
func (s *SuggestionService) AppendProgress(jobID, ownerUserID, note string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var job model.ImplementationJob
		if err := tx.Where("id = ?", jobID).First(&job).Error; err != nil {
			return ErrSuggestionJobNotFound
		}
		if job.OwnerUserID != ownerUserID {
			return ErrSuggestionJobNotOwner
		}
		if job.Status == "done" || job.Status == "failed" {
			return fmt.Errorf("任务已结束（%s），不能再追加进展", job.Status)
		}
		var notes []progressNote
		_ = json.Unmarshal([]byte(job.ProgressLog), &notes)
		notes = append(notes, progressNote{Note: note, At: time.Now()})
		if len(notes) > 50 {
			notes = notes[len(notes)-50:]
		}
		raw, _ := json.Marshal(notes)
		if err := tx.Model(&job).Update("progress_log", string(raw)).Error; err != nil {
			return err
		}
		WriteChangelog(tx, job.IdeaID, ChangelogTypeJobProgress, note, "", jobID, "user", ownerUserID, "")
		return nil
	})
}

// ReportJobResult 由 report_job_result 调用：终态回报（done/failed）。
// 完成时同步 idea 的 impl_status=implemented 并回填 repo_url。
func (s *SuggestionService) ReportJobResult(jobID, ownerUserID, status, summary, repoURL, commitSHA string) (*model.ImplementationJob, error) {
	if status != "done" && status != "failed" {
		return nil, fmt.Errorf("status 只能是 done 或 failed")
	}
	var notifyRecipient, notifyIdeaID, notifySummary string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var job model.ImplementationJob
		if err := tx.Where("id = ?", jobID).First(&job).Error; err != nil {
			return ErrSuggestionJobNotFound
		}
		if job.OwnerUserID != ownerUserID {
			return ErrSuggestionJobNotOwner
		}
		if !jobTransitions[job.Status][status] {
			return fmt.Errorf("任务当前状态为 %s，不能变更为 %s", job.Status, status)
		}
		updates := map[string]interface{}{"status": status}
		if summary != "" {
			updates["result_summary"] = summary
		}
		if repoURL != "" {
			updates["repo_url"] = repoURL
		}
		if commitSHA != "" {
			updates["commit_sha"] = commitSHA
		}
		if err := tx.Model(&job).Updates(updates).Error; err != nil {
			return err
		}

		if status == "done" {
			// 同步 idea：实现完成 + 回填仓库地址
			ideaUpdates := map[string]interface{}{"impl_status": "implemented"}
			if repoURL != "" {
				ideaUpdates["repo_url"] = repoURL
			}
			tx.Model(&model.Idea{}).Where("id = ?", job.IdeaID).Updates(ideaUpdates)
			WriteChangelog(tx, job.IdeaID, ChangelogTypeJobDone, "实现完成",
				joinDetail(summary, repoURL, commitSHA), jobID, "user", ownerUserID, "")

			if job.SuggestionID != nil {
				logActivity(tx, "user", ownerUserID, ActionSuggestionImplemented, "idea", job.IdeaID, nil)
				var sug model.IdeaSuggestion
				if err := tx.Where("id = ?", *job.SuggestionID).First(&sug).Error; err == nil {
					recipient := sug.UserID
					var suggesterOwner string
					if err := tx.Model(&model.Agent{}).Where("id = ?", sug.UserID).Pluck("COALESCE(owner_user_id, '')", &suggesterOwner).Error; err == nil && suggesterOwner != "" {
						recipient = suggesterOwner
					}
					if recipient != "" && recipient != ownerUserID {
						notifyRecipient = recipient
						notifyIdeaID = job.IdeaID
						notifySummary = truncateSummary(sug.Content)
					}
				}
			}
		} else {
			WriteChangelog(tx, job.IdeaID, ChangelogTypeJobFailed, "实现未成",
				summary, jobID, "user", ownerUserID, "")
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if s.notif != nil && notifyRecipient != "" {
		_ = s.notif.Create(notifyRecipient, "user", ownerUserID, "", "suggestion_implemented", "idea", notifyIdeaID, notifySummary)
	}
	var job model.ImplementationJob
	if err := s.db.Where("id = ?", jobID).First(&job).Error; err != nil {
		return nil, ErrSuggestionJobNotFound
	}
	return &job, nil
}

// AskUser 由 ask_user 调用：落一条问题 + 通知 owner，返回问题 ID 供长轮询。
// actorType/actorID 用于通知展示（Agent 发起则 actor 为该 Agent，否则为用户）。
func (s *SuggestionService) AskUser(jobID, ownerUserID, actorID, question string) (string, error) {
	var ideaID string
	q := &model.JobQuestion{JobID: jobID, Question: question}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var job model.ImplementationJob
		if err := tx.Where("id = ?", jobID).First(&job).Error; err != nil {
			return ErrSuggestionJobNotFound
		}
		if job.OwnerUserID != ownerUserID {
			return ErrSuggestionJobNotOwner
		}
		if job.Status == "done" || job.Status == "failed" {
			return fmt.Errorf("任务已结束（%s），不能再提问", job.Status)
		}
		ideaID = job.IdeaID
		return tx.Create(q).Error
	})
	if err != nil {
		return "", err
	}
	if s.notif != nil {
		actorType := "user"
		if actorID != "" {
			actorType = "agent"
		}
		_ = s.notif.Create(ownerUserID, actorType, actorID, "", "job_question", "idea", ideaID, truncateSummary(question))
	}
	return q.ID, nil
}

// WaitForAnswer 长轮询等待用户回答（2s 一次，最长 timeout）。
// 返回 (answer, true) 表示已回答；(空, false) 表示超时。
func (s *SuggestionService) WaitForAnswer(ctx context.Context, questionID string, timeout time.Duration) (string, bool, error) {
	deadline := time.Now().Add(timeout)
	for {
		var q model.JobQuestion
		if err := s.db.Where("id = ?", questionID).First(&q).Error; err != nil {
			return "", false, ErrSuggestionJobNotFound
		}
		if q.AnsweredAt != nil {
			return q.Answer, true, nil
		}
		if time.Now().After(deadline) {
			return "", false, nil
		}
		select {
		case <-ctx.Done():
			return "", false, ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
}

// AnswerQuestion 由用户在任务队列页回答 Agent 的提问。
func (s *SuggestionService) AnswerQuestion(questionID, ownerUserID, answer string) error {
	now := time.Now()
	return s.db.Transaction(func(tx *gorm.DB) error {
		var q model.JobQuestion
		if err := tx.Where("id = ?", questionID).First(&q).Error; err != nil {
			return ErrSuggestionJobNotFound
		}
		var job model.ImplementationJob
		if err := tx.Where("id = ?", q.JobID).First(&job).Error; err != nil {
			return ErrSuggestionJobNotFound
		}
		if job.OwnerUserID != ownerUserID {
			return ErrSuggestionJobNotOwner
		}
		return tx.Model(&q).Updates(map[string]interface{}{
			"answer": answer, "answered_at": now,
		}).Error
	})
}

// joinDetail 把完成摘要与仓库/commit 拼为事件补充信息。
func joinDetail(summary, repoURL, commitSHA string) string {
	parts := []string{}
	if summary != "" {
		parts = append(parts, summary)
	}
	if repoURL != "" {
		parts = append(parts, repoURL)
	}
	if commitSHA != "" {
		parts = append(parts, commitSHA)
	}
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += " · "
		}
		out += p
	}
	return out
}
