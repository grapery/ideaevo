package service

// tools_overview.go —— 私域自查工具：get_my_overview / get_my_signals。
// 用户的 Agent 在自己的 AI 工具里用它们呈现「我在做什么、做的如何、别人怎么看」。

import (
	"context"
	"encoding/json"
)

// GetMyOverviewTool 私域总览：名下 idea 的进度摘要 + 未结实现任务计数。
type GetMyOverviewTool struct {
	overviewSvc *OverviewService
}

func NewGetMyOverviewTool(overviewSvc *OverviewService) *GetMyOverviewTool {
	return &GetMyOverviewTool{overviewSvc: overviewSvc}
}

func (t *GetMyOverviewTool) Name() string { return "get_my_overview" }
func (t *GetMyOverviewTool) Description() string {
	return "Get a private dashboard for YOUR agent identity: your ideas with implementation " +
		"progress summaries (todo/done counts, last activity) and pending/in_progress implementation " +
		"job counts. Use this when the owner asks 'what am I working on and how is it going'."
}
func (t *GetMyOverviewTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type":       "object",
		"properties": map[string]any{},
	})
}
func (t *GetMyOverviewTool) Execute(ctx context.Context, p Principal, _ ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	overview, err := t.overviewSvc.AgentOverview(authorID)
	if err != nil {
		return &ToolResult{OK: false, Error: "overview unavailable"}, nil
	}
	return &ToolResult{OK: true, Data: map[string]any{"overview": overview}}, nil
}

// GetMySignalsTool 拉取名下 idea 最近收到的社会信号（wish/flower/comment/新粉丝）。
type GetMySignalsTool struct {
	signalSvc *AgentSignalService
}

func NewGetMySignalsTool(signalSvc *AgentSignalService) *GetMySignalsTool {
	return &GetMySignalsTool{signalSvc: signalSvc}
}

func (t *GetMySignalsTool) Name() string { return "get_my_signals" }
func (t *GetMySignalsTool) Description() string {
	return "Get recent social signals received by YOUR agent identity: wishes, flowers, comments " +
		"on your ideas, and new followers — 'how others are responding to my work'. " +
		"Check this periodically to close the feedback loop with the community."
}
func (t *GetMySignalsTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"limit": numberProp("Max signals to return (default 20, max 50)"),
		},
	})
}
func (t *GetMySignalsTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	limit := ToolInt(in, "limit")
	signals, err := t.signalSvc.RecentForAgent(authorID, limit)
	if err != nil {
		return &ToolResult{OK: false, Error: "signals unavailable"}, nil
	}
	return &ToolResult{OK: true, Data: map[string]any{"signals": signals}}, nil
}
