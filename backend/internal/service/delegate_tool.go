package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// DelegateToAgentTool 让一个 Agent 在对话中把任务委派给站内另一个 Agent。
// 这是 A2A Client 侧的实现——通过 HTTP 调用目标 Agent 的 A2A 端点。
type DelegateToAgentTool struct {
	db       *gorm.DB
	agentSvc *AgentService
	baseURL  string // 本站 API base URL，如 "http://localhost:8080"
}

func NewDelegateToAgentTool(db *gorm.DB, agentSvc *AgentService, baseURL string) *DelegateToAgentTool {
	return &DelegateToAgentTool{db: db, agentSvc: agentSvc, baseURL: baseURL}
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

	// 调用目标 Agent 的 A2A 端点（JSON-RPC tasks/send）
	taskID := uuid.New().String()
	rpcReq := map[string]any{
		"jsonrpc": "2.0",
		"id":      taskID,
		"method":  "tasks/send",
		"params": map[string]any{
			"id": taskID,
			"message": map[string]any{
				"role":      "user",
				"messageId": uuid.New().String(),
				"parts":     []map[string]any{{"type": "text", "text": taskText}},
			},
		},
	}

	body, _ := json.Marshal(rpcReq)
	url := fmt.Sprintf("%s/a2a/agents/%s", t.baseURL, targetID)

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return &ToolResult{OK: false, Error: fmt.Sprintf("创建请求失败: %v", err)}, nil
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return &ToolResult{OK: false, Error: fmt.Sprintf("调用 Agent %s 失败: %v", target.Name, err)}, nil
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	// 解析 JSON-RPC 响应
	var rpcResp struct {
		Result *struct {
			ID      string `json:"id"`
			State   string `json:"state"`
			Messages []struct {
				Role  string `json:"role"`
				Parts []struct {
					Type string `json:"type"`
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"messages"`
		} `json:"result"`
		Error *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(respBody, &rpcResp); err != nil {
		return &ToolResult{OK: false, Error: fmt.Sprintf("解析响应失败: %v", err)}, nil
	}

	if rpcResp.Error != nil {
		return &ToolResult{
			OK:    false,
			Error: fmt.Sprintf("Agent %s 返回错误: %s", target.Name, rpcResp.Error.Message),
		}, nil
	}

	if rpcResp.Result == nil {
		return &ToolResult{OK: false, Error: "Agent 返回空结果"}, nil
	}

	// 提取目标 Agent 的回复文本
	var responseText string
	for _, msg := range rpcResp.Result.Messages {
		if msg.Role == "agent" {
			for _, p := range msg.Parts {
				if p.Type == "text" && p.Text != "" {
					responseText = p.Text
					break
				}
			}
		}
	}

	// 记录 A2A 委派任务
	callerID := p.AgentID
	if callerID == "" {
		callerID = p.UserID
	}
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
