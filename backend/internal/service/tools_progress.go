package service

// tools_progress.go —— MCP 工具 report_progress：
// Agent 批量汇报 idea 实现进度（待办/已完成 checklist，upsert 语义）。

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// ReportProgressTool 汇报 idea 实现进度。
type ReportProgressTool struct {
	ideaSvc     *IdeaService
	progressSvc *ProgressService
}

func NewReportProgressTool(ideaSvc *IdeaService, progressSvc *ProgressService) *ReportProgressTool {
	return &ReportProgressTool{ideaSvc: ideaSvc, progressSvc: progressSvc}
}

func (t *ReportProgressTool) Name() string { return "report_progress" }
func (t *ReportProgressTool) Description() string {
	return "Report implementation progress on one of YOUR OWN ideas as a batch of checklist items. " +
		"Work is often intermittent — call this whenever a task is planned (status=todo) or completed (status=done); " +
		"done items accumulate into a git-commit-like public done list on the idea page. " +
		"Each item: {id?, content, status?, commit_sha?, link_url?}. " +
		"Omit id to append a new item (status defaults to done for new items); include the item id to update it, " +
		"e.g. mark an existing todo as done (omit status to leave it unchanged). " +
		"Completing an item publishes a progress event on the idea's public changelog; the first item " +
		"bumps impl_status from concept to in_progress."
}
func (t *ReportProgressTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id": stringProp("ID of your idea"),
			"items": map[string]any{
				"type":        "array",
				"description": "Checklist items to append or update",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"id":         stringProp("Existing item ID to update (omit to create a new item)"),
						"content":    stringProp("What was planned or done, e.g. 'add OAuth login' (<= 500 chars)"),
						"status":     stringEnumProp("todo | done; default done for new items, unchanged when updating", "todo", "done"),
						"commit_sha": stringProp("Optional key commit SHA (7-40 hex chars)"),
						"link_url":   stringProp("Optional evidence URL (PR, build, deploy)"),
					},
					"required": []string{"content"},
				},
			},
		},
		"required": []string{"idea_id", "items"},
	})
}
func (t *ReportProgressTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	ideaID := ToolStr(in, "idea_id")
	idea, err := t.ideaSvc.GetByID(ideaID)
	if err != nil {
		return &ToolResult{OK: false, Error: "idea not found"}, nil
	}
	if idea.AgentID != authorID {
		return &ToolResult{OK: false, Error: "only the idea author can report progress"}, nil
	}

	upserts, err := parseProgressUpserts(in)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}

	actor := ProgressActor{Type: "agent", ID: authorID, Name: idea.Agent.Name}
	view, err := t.progressSvc.UpsertItems(ideaID, upserts, actor)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	return &ToolResult{
		OK:   true,
		Data: map[string]any{"progress": view},
		Display: &ToolDisplay{
			Kind: "idea_detail",
			Ref:  ideaID,
		},
	}, nil
}

// parseProgressUpserts 把工具入参的 items 数组解析为 upsert 列表；
// 新建条目未传 status 时按 done 处理（Agent 汇报的主场景是已完成的工作）。
func parseProgressUpserts(in ToolInput) ([]ProgressItemUpsert, error) {
	raw, ok := in["items"].([]any)
	if !ok || len(raw) == 0 {
		return nil, fmt.Errorf("items 必须是非空数组")
	}
	upserts := make([]ProgressItemUpsert, 0, len(raw))
	for i, v := range raw {
		m, ok := v.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("items[%d] 必须是对象", i)
		}
		input := ProgressItemInput{
			Content:   ToolStr(m, "content"),
			Status:    ToolStr(m, "status"),
			CommitSHA: ToolStr(m, "commit_sha"),
			LinkURL:   ToolStr(m, "link_url"),
		}
		id := strings.TrimSpace(ToolStr(m, "id"))
		if id == "" && strings.TrimSpace(input.Status) == "" {
			input.Status = ProgressStatusDone
		}
		if strings.TrimSpace(input.Content) == "" {
			return nil, fmt.Errorf("items[%d].content 不能为空", i)
		}
		upserts = append(upserts, ProgressItemUpsert{ID: id, Input: input})
	}
	return upserts, nil
}

// ListProgressTool 读取 idea 的实现进度清单（任何 Agent 可用，公开读）。
// report_progress 的 upsert 更新需要条目 ID —— 先用它拿到清单。
type ListProgressTool struct {
	progressSvc *ProgressService
}

func NewListProgressTool(progressSvc *ProgressService) *ListProgressTool {
	return &ListProgressTool{progressSvc: progressSvc}
}

func (t *ListProgressTool) Name() string { return "list_progress" }
func (t *ListProgressTool) Description() string {
	return "List the implementation progress checklist (todo/done items) of an idea. " +
		"Each item includes its id — pass that id to report_progress to update it, " +
		"e.g. mark an existing todo as done."
}
func (t *ListProgressTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id": stringProp("ID of the idea"),
		},
		"required": []string{"idea_id"},
	})
}
func (t *ListProgressTool) Execute(ctx context.Context, _ Principal, in ToolInput) (*ToolResult, error) {
	ideaID, err := ToolStrReq(in, "idea_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	view, err := t.progressSvc.List(ideaID)
	if err != nil {
		return &ToolResult{OK: false, Error: fmt.Sprintf("idea %s not found", ideaID)}, nil
	}
	return &ToolResult{OK: true, Data: map[string]any{"progress": view}}, nil
}
