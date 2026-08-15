package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// DelegateToAgentTool 让一个 Agent 在对话中把任务委派给站内另一个 Agent。
// 通过内部函数调用（非 HTTP）执行目标 Agent，避免鉴权问题。
type DelegateToAgentTool struct {
	db           *gorm.DB
	agentSvc     *AgentService
	delegateFn   func(ctx context.Context, targetAgentID string, task string, callerAgentID string) (string, error)
}

// DelegateFunc 是进程内委派函数签名。
type DelegateFunc func(ctx context.Context, targetAgentID string, task string, callerAgentID string) (string, error)

func NewDelegateToAgentTool(db *gorm.DB, agentSvc *AgentService, delegateFn DelegateFunc) *DelegateToAgentTool {
	return &DelegateToAgentTool{db: db, agentSvc: agentSvc, delegateFn: delegateFn}
}

func (t *DelegateToAgentTool) Name() string { return "delegate_to_agent" }

func (t *DelegateToAgentTool) Description() string {
	return "将任务委派给本站的另一个 Agent 执行。适用于需要不同专业能力的场景，" +
		"例如让代码专家审查代码、让数据分析师处理数据。参数：target_agent_id（目标 Agent ID）" +
		"和 task（委派的任务描述）。"
}

func (t *DelegateToAgentTool) Parameters() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"target_agent_id": {
				"type": "string",
				"description": "目标 Agent 的 ID（站内注册的 Agent）"
			},
			"task": {
				"type": "string",
				"description": "委派给目标 Agent 的任务描述，应清晰、具体"
			}
		},
		"required": ["target_agent_id", "task"]
	}`)
}

func (t *DelegateToAgentTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	targetID, _ := in["target_agent_id"].(string)
	taskText, _ := in["task"].(string)

	if targetID == "" || taskText == "" {
		return &ToolResult{OK: false, Error: "target_agent_id 和 task 都是必填参数"}, nil
	}

	// 校验目标 Agent 存在且公开
	var target model.Agent
	if err := t.db.First(&target, "id = ?", targetID).Error; err != nil {
		return &ToolResult{OK: false, Error: fmt.Sprintf("目标 Agent %s 不存在", targetID)}, nil
	}
	if target.Visibility == "private" && target.OwnerUserID != p.UserID {
		return &ToolResult{OK: false, Error: "目标 Agent 是私有的，无法委派"}, nil
	}

	// 通过进程内函数调用目标 Agent（避免 HTTP 鉴权问题）
	callerID := p.AgentID
	if callerID == "" {
		callerID = "user:" + p.UserID
	}

	responseText, err := t.delegateFn(ctx, targetID, taskText, callerID)
	if err != nil {
		return &ToolResult{
			OK:    false,
			Error: fmt.Sprintf("调用 Agent %s 失败: %v", target.Name, err),
		}, nil
	}

	// 记录 A2A 委派任务
	taskID := uuid.New().String()
	a2aTask := &model.A2ATask{
		ID:            taskID,
		CallerAgentID: callerID,
		TargetAgentID: targetID,
		Status:        model.A2ATaskStatusCompleted,
		InputText:     taskText,
		OutputText:    responseText,
	}
	if p.SessionID != "" {
		a2aTask.SessionID = p.SessionID
	}
	t.db.Create(a2aTask)

	return &ToolResult{
		OK: true,
		Data: map[string]any{
			"target_agent": target.Name,
			"task":         taskText,
			"response":     responseText,
		},
		Display: &ToolDisplay{
			Kind: "a2a_delegation",
			Ref:  targetID,
		},
	}, nil
}
