package service

// tools_jobs.go —— 本地编码 Agent 桥（L0）：Claude Code / Codex / Zcode 经 MCP
// 直接操作任务队列，完成「领取 → 推进 → 提问 → 回报」闭环。
//
//	claim_next_job    原子领取下一个 pending 任务，返回完整规格
//	send_progress     追加阶段性说明（owner 在任务队列页可见）
//	ask_user          向 owner 提问并长轮询等待回答
//	report_job_result 终态回报（done 同步 idea 实现状态与仓库地址）

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// GetJobSpecTool 重读任务规格（含进展与问答历史），只读。
type GetJobSpecTool struct {
	suggestionSvc *SuggestionService
	agentSvc      *AgentService
}

func NewGetJobSpecTool(svc *SuggestionService, agentSvc *AgentService) *GetJobSpecTool {
	return &GetJobSpecTool{suggestionSvc: svc, agentSvc: agentSvc}
}

func (t *GetJobSpecTool) Name() string { return "get_job_spec" }
func (t *GetJobSpecTool) Description() string {
	return "Re-read the full spec of an implementation job you own, including progress notes and Q&A history. " +
		"Use to rebuild context after your session crashed, or to resume a partially implemented job."
}
func (t *GetJobSpecTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"job_id": stringProp("ID of the implementation job"),
		},
		"required": []string{"job_id"},
	})
}
func (t *GetJobSpecTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	owner := resolvePrincipalUser(p, t.agentSvc)
	if owner == "" {
		return &ToolResult{OK: false, Error: "login required (user or agent api_key)"}, nil
	}
	jobID, err := ToolStrReq(in, "job_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	spec, err := t.suggestionSvc.GetJobSpec(jobID, owner)
	if err != nil {
		return nil, fmt.Errorf("get_job_spec failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"job": spec}}, nil
}

// ClaimNextJobTool 领取下一个待实现任务。
type ClaimNextJobTool struct {
	suggestionSvc *SuggestionService
	agentSvc      *AgentService
}

func NewClaimNextJobTool(svc *SuggestionService, agentSvc *AgentService) *ClaimNextJobTool {
	return &ClaimNextJobTool{suggestionSvc: svc, agentSvc: agentSvc}
}

func (t *ClaimNextJobTool) Name() string { return "claim_next_job" }
func (t *ClaimNextJobTool) Description() string {
	return "Claim the next pending implementation job from the user's Deimos task queue and get its full spec " +
		"(idea title/description, adopted suggestion content to implement). " +
		"The job transitions to in_progress. Returns empty when no pending job exists. " +
		"After implementing, call report_job_result; post updates via send_progress; ask ask_user when the requirement is unclear; call get_job_spec to rebuild context after a crash or to resume."
}
func (t *ClaimNextJobTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type":       "object",
		"properties": map[string]any{},
	})
}
func (t *ClaimNextJobTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	owner := resolvePrincipalUser(p, t.agentSvc)
	if owner == "" {
		return &ToolResult{OK: false, Error: "login required (user or agent api_key)"}, nil
	}
	spec, err := t.suggestionSvc.ClaimNextJob(owner)
	if err != nil {
		return nil, fmt.Errorf("claim_next_job failed: %w", err)
	}
	if spec == nil {
		return &ToolResult{OK: true, Data: map[string]any{"job": nil, "message": "no pending job"}}, nil
	}
	return &ToolResult{OK: true, Data: map[string]any{"job": spec}}, nil
}

// SendProgressTool 追加阶段性进展说明。
type SendProgressTool struct {
	suggestionSvc *SuggestionService
	agentSvc      *AgentService
}

func NewSendProgressTool(svc *SuggestionService, agentSvc *AgentService) *SendProgressTool {
	return &SendProgressTool{suggestionSvc: svc, agentSvc: agentSvc}
}

func (t *SendProgressTool) Name() string { return "send_progress" }
func (t *SendProgressTool) Description() string {
	return "Append a progress note to an in-progress implementation job so the owner can follow along " +
		"on the Deimos jobs page (e.g. 'scaffold done', 'tests passing'). Call at meaningful milestones."
}
func (t *SendProgressTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"job_id": stringProp("ID of the implementation job (from claim_next_job)"),
			"note":   stringProp("Short progress note"),
		},
		"required": []string{"job_id", "note"},
	})
}
func (t *SendProgressTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	owner := resolvePrincipalUser(p, t.agentSvc)
	if owner == "" {
		return &ToolResult{OK: false, Error: "login required (user or agent api_key)"}, nil
	}
	jobID, err := ToolStrReq(in, "job_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	note, err := ToolStrReq(in, "note")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	if err := t.suggestionSvc.AppendProgress(jobID, owner, note); err != nil {
		return nil, fmt.Errorf("send_progress failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"recorded": true}}, nil
}

// AskUserTool 向 owner 提问并等待回答（长轮询）。
type AskUserTool struct {
	suggestionSvc *SuggestionService
	agentSvc      *AgentService
}

func NewAskUserTool(svc *SuggestionService, agentSvc *AgentService) *AskUserTool {
	return &AskUserTool{svc, agentSvc}
}

func (t *AskUserTool) Name() string { return "ask_user" }
func (t *AskUserTool) Description() string {
	return "Ask the job owner a clarifying question about the idea/requirement. " +
		"The question appears on the Deimos jobs page with a notification; this call blocks waiting for the answer " +
		"(wait_seconds, default 120, max 300). If it times out, proceed with your best judgment or park the work."
}
func (t *AskUserTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"job_id":   stringProp("ID of the implementation job"),
			"question": stringProp("The question to ask the owner"),
			"wait_seconds": map[string]any{
				"type": "integer", "description": "How long to wait for the answer (default 120, max 300)",
			},
		},
		"required": []string{"job_id", "question"},
	})
}
func (t *AskUserTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	owner := resolvePrincipalUser(p, t.agentSvc)
	if owner == "" {
		return &ToolResult{OK: false, Error: "login required (user or agent api_key)"}, nil
	}
	jobID, err := ToolStrReq(in, "job_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	question, err := ToolStrReq(in, "question")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	waitSeconds := ToolInt(in, "wait_seconds")
	if waitSeconds <= 0 {
		waitSeconds = 120
	}
	if waitSeconds > 300 {
		waitSeconds = 300
	}
	wait := time.Duration(waitSeconds) * time.Second
	questionID, err := t.suggestionSvc.AskUser(jobID, owner, p.AgentID, question)
	if err != nil {
		return nil, fmt.Errorf("ask_user failed: %w", err)
	}
	answer, answered, err := t.suggestionSvc.WaitForAnswer(ctx, questionID, wait)
	if err != nil {
		return nil, fmt.Errorf("ask_user wait failed: %w", err)
	}
	if !answered {
		return &ToolResult{OK: true, Data: map[string]any{
			"question_id": questionID, "answered": false,
			"message": "timeout: no answer yet, proceed with best judgment",
		}}, nil
	}
	return &ToolResult{OK: true, Data: map[string]any{
		"question_id": questionID, "answered": true, "answer": answer,
	}}, nil
}

// ReportJobResultTool 终态回报。
type ReportJobResultTool struct {
	suggestionSvc *SuggestionService
	agentSvc      *AgentService
}

func NewReportJobResultTool(svc *SuggestionService, agentSvc *AgentService) *ReportJobResultTool {
	return &ReportJobResultTool{svc, agentSvc}
}

func (t *ReportJobResultTool) Name() string { return "report_job_result" }
func (t *ReportJobResultTool) Description() string {
	return "Report the final result of an implementation job: status done or failed, " +
		"with a summary, the repo URL and key commit SHA of the implementation. " +
		"On done, the idea's impl_status becomes implemented and repo_url is backfilled."
}
func (t *ReportJobResultTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"job_id":     stringProp("ID of the implementation job"),
			"status":     stringEnumProp("done when implemented successfully, failed otherwise", "done", "failed"),
			"summary":    stringProp("What was built/changed, or why it failed"),
			"repo_url":   stringProp("Repository URL of the implementation (optional)"),
			"commit_sha": stringProp("Key commit SHA (optional)"),
		},
		"required": []string{"job_id", "status", "summary"},
	})
}
func (t *ReportJobResultTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	owner := resolvePrincipalUser(p, t.agentSvc)
	if owner == "" {
		return &ToolResult{OK: false, Error: "login required (user or agent api_key)"}, nil
	}
	jobID, err := ToolStrReq(in, "job_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	status, err := ToolStrReq(in, "status")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	summary := ToolStr(in, "summary")
	job, err := t.suggestionSvc.ReportJobResult(jobID, owner, status, summary, ToolStr(in, "repo_url"), ToolStr(in, "commit_sha"))
	if err != nil {
		return nil, fmt.Errorf("report_job_result failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{
		"job_id": job.ID, "status": job.Status,
		"repo_url": job.RepoURL, "commit_sha": job.CommitSHA,
	}}, nil
}

// ListMyJobsTool 查看当前用户的实现任务队列（只读）。
type ListMyJobsTool struct {
	suggestionSvc *SuggestionService
	agentSvc      *AgentService
}

func NewListMyJobsTool(svc *SuggestionService, agentSvc *AgentService) *ListMyJobsTool {
	return &ListMyJobsTool{suggestionSvc: svc, agentSvc: agentSvc}
}

func (t *ListMyJobsTool) Name() string { return "list_my_jobs" }
func (t *ListMyJobsTool) Description() string {
	return "List the user's implementation jobs with status, progress notes, repo URL and pending questions. " +
		"Use to check the queue before/after claiming, or to report status to the user."
}
func (t *ListMyJobsTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type":       "object",
		"properties": map[string]any{},
	})
}
func (t *ListMyJobsTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	owner := resolvePrincipalUser(p, t.agentSvc)
	if owner == "" {
		return &ToolResult{OK: false, Error: "login required (user or agent api_key)"}, nil
	}
	jobs, err := t.suggestionSvc.ListJobs(owner)
	if err != nil {
		return nil, fmt.Errorf("list_my_jobs failed: %w", err)
	}
	if jobs == nil {
		jobs = []JobView{}
	}
	return &ToolResult{OK: true, Data: map[string]any{"jobs": jobs, "total": len(jobs)}}, nil
}
