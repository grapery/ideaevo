package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IdeaSuggestion 是对某个 idea 的「建议」（类似需求提案）。
// 内容支持文字 + 图片（图片为 OSS 公网 URL 数组）；其他用户可投票；
// idea 拥有者可采纳（SelectedAt 非空即已采纳），采纳后创建 ImplementationJob。
type IdeaSuggestion struct {
	ID         string     `gorm:"primaryKey;size:36" json:"id"`
	IdeaID     string     `gorm:"size:36;not null;index" json:"idea_id"`
	UserID     string     `gorm:"size:36;not null" json:"user_id"` // 提交者：用户 ID 或 Agent ID（与 Comment 同一约定，富化时区分）
	Content    string     `gorm:"type:text;not null" json:"content"`
	ImageURLs  string     `gorm:"type:json" json:"image_urls"` // JSON 数组字符串，与 Idea.Tags 同一存储约定
	VoteCount  int        `gorm:"not null;default:0" json:"vote_count"`
	SelectedAt *time.Time `json:"selected_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

func (s *IdeaSuggestion) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	if s.ImageURLs == "" {
		s.ImageURLs = "[]"
	}
	return nil
}

func (s IdeaSuggestion) Selected() bool {
	return s.SelectedAt != nil
}

// SuggestionVote 与 Wish/Like 同构：同一 actor 对同一建议仅一票，
// 三字段联合唯一兜底，服务层再做同 owner（用户 + 其所有 Agent）防刷。
type SuggestionVote struct {
	ID           string    `gorm:"primaryKey;size:36" json:"id"`
	SuggestionID string    `gorm:"size:36;not null;uniqueIndex:idx_suggestion_vote_unique" json:"suggestion_id"`
	UserID       string    `gorm:"size:36;uniqueIndex:idx_suggestion_vote_unique" json:"user_id"`
	AgentID      string    `gorm:"size:36;uniqueIndex:idx_suggestion_vote_unique" json:"agent_id"`
	CreatedAt    time.Time `json:"created_at"`
}

func (v *SuggestionVote) BeforeCreate(tx *gorm.DB) error {
	if v.ID == "" {
		v.ID = uuid.New().String()
	}
	return nil
}

// ImplementationJob 表示「owner 已采纳建议、待在本地机器执行」的实现任务。
// 本次迭代仅落库（status=pending），为后续 SSE 推送 / 本地 Runner 预留；
// SuggestionID 为空表示整体性任务（未来 fork 后直接实现等场景）。
type ImplementationJob struct {
	ID     string `gorm:"primaryKey;size:36" json:"id"`
	IdeaID string `gorm:"size:36;not null;index" json:"idea_id"`
	// 唯一索引兜底：同一建议只产生一个任务（NULL 不参与唯一约束，兼容无建议的整体性任务）
	SuggestionID *string `gorm:"size:36;uniqueIndex" json:"suggestion_id,omitempty"`
	OwnerUserID  string  `gorm:"size:36;not null;index" json:"owner_user_id"`
	Status       string  `gorm:"size:20;not null;default:'pending'" json:"status"` // pending | in_progress | done | failed
	// 完成备注（如发布版本号/链接），完成或失败时由 owner 填写
	Note string `gorm:"size:1000" json:"note,omitempty"`
	Brief string `gorm:"type:json" json:"brief"` // 任务简报快照（idea 标题/描述 + 建议内容）
	// 以下由本地编码 Agent（经 MCP claim_next_job 等工具）回填
	RepoURL       string    `gorm:"size:500" json:"repo_url,omitempty"`        // 实现产出的仓库地址
	CommitSHA     string    `gorm:"size:40" json:"commit_sha,omitempty"`       // 关键 commit
	ResultSummary string    `gorm:"size:2000" json:"result_summary,omitempty"` // Agent 的完成报告
	ProgressLog   string    `gorm:"type:json" json:"progress_log"`             // [{note, at}] 阶段性进展，由 send_progress 追加
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (j *ImplementationJob) BeforeCreate(tx *gorm.DB) error {
	if j.ID == "" {
		j.ID = uuid.New().String()
	}
	if j.Status == "" {
		j.Status = "pending"
	}
	if j.Brief == "" {
		j.Brief = "{}"
	}
	if j.ProgressLog == "" {
		j.ProgressLog = "[]"
	}
	return nil
}

// JobQuestion 是执行中的本地编码 Agent 通过 ask_user 向 owner 提出的问题。
// Answer 非空表示用户已在任务队列页回答；MCP 侧长轮询等待答案。
type JobQuestion struct {
	ID         string     `gorm:"primaryKey;size:36" json:"id"`
	JobID      string     `gorm:"size:36;not null;index" json:"job_id"`
	Question   string     `gorm:"size:2000;not null" json:"question"`
	Answer     string     `gorm:"size:4000" json:"answer,omitempty"`
	AnsweredAt *time.Time `json:"answered_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

func (q *JobQuestion) BeforeCreate(tx *gorm.DB) error {
	if q.ID == "" {
		q.ID = uuid.New().String()
	}
	return nil
}
