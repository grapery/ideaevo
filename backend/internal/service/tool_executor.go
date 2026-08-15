package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// ToolCall 表示一次 LLM 工具调用（OpenAI tool_call 格式）。
type ToolCall struct {
	ID       string          `json:"id"`
	Name     string          `json:"name"`
	ArgsJSON json.RawMessage `json:"args"` // 原始 JSON 参数
}

// ToolCallResult 是一次工具执行的结果（用于回灌给 LLM）。
type ToolCallResult struct {
	ToolCallID string       `json:"tool_call_id"`
	Name       string       `json:"name"`
	Output     string       `json:"output"` // 序列化后的 ToolResult JSON
	Display    *ToolDisplay `json:"display,omitempty"`
	OK         bool         `json:"ok"`
}

// ToolExecutor 负责把 ToolRegistry 中的工具暴露为 OpenAI tools 定义，
// 并批量执行 LLM 返回的 tool_calls。
type ToolExecutor struct {
	registry *ToolRegistry
	conf     *ToolConfirmation
}

func NewToolExecutor(registry *ToolRegistry) *ToolExecutor {
	return &ToolExecutor{
		registry: registry,
		conf:     NewToolConfirmation(),
	}
}

// Confirmation 返回二次确认管理器（供测试或外部清理用）。
func (e *ToolExecutor) Confirmation() *ToolConfirmation { return e.conf }

// OpenAITool 把一个 Tool 转成 OpenAI tools 数组元素格式。
type OpenAITool struct {
	Type     string             `json:"type"` // always "function"
	Function OpenAIToolFunction `json:"function"`
}

type OpenAIToolFunction struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

// ToolsDefinition 生成传给 LLM 的 tools 数组。
// allowNames 为空表示开放全部工具；非空则只暴露白名单内的工具
// （用于不同 Agent 能力差异化，例如只读助手不暴露 register_idea）。
func (e *ToolExecutor) ToolsDefinition(allowNames []string) []OpenAITool {
	allow := toSet(allowNames)
	out := make([]OpenAITool, 0)
	for _, t := range e.registry.List() {
		if len(allow) > 0 && !allow[t.Name()] {
			continue
		}
		out = append(out, OpenAITool{
			Type: "function",
			Function: OpenAIToolFunction{
				Name:        t.Name(),
				Description: t.Description(),
				Parameters:  t.Parameters(),
			},
		})
	}
	return out
}

// ExecuteBatch 批量执行 tool_calls，返回每条结果（顺序与输入一致）。
// 单条工具失败不会中断其它工具的执行，会作为 OK=false 的结果返回给 LLM。
// 只有 ctx 被取消等系统级错误才返回 error。
//
// 写操作（register/fork/bury/flowers）需要二次确认：
//   - 参数中 confirm 为空 → 拦截，返回 confirmation token + 摘要让 LLM 转交用户确认
//   - confirm 为 token 且校验通过 → 真正执行
func (e *ToolExecutor) ExecuteBatch(ctx context.Context, p Principal, calls []ToolCall) ([]ToolCallResult, error) {
	results := make([]ToolCallResult, 0, len(calls))
	for _, call := range calls {
		// 写操作二次确认拦截
		if IsWriteTool(call.Name) {
			confirmed, confirmMsg, intercepted := e.handleConfirmation(call, p)
			if intercepted {
				results = append(results, ToolCallResult{
					ToolCallID: call.ID,
					Name:       call.Name,
					Output:     toJSONString(map[string]any{"ok": false, "need_confirmation": true, "message": confirmMsg}),
					OK:         false,
				})
				continue
			}
			if !confirmed {
				results = append(results, makeErrorResult(call, confirmMsg))
				continue
			}
		}

		// 每个工具单独设超时，避免某个工具卡死整个对话
		// delegate_to_agent 是 A2A 调用，需要更长超时
		timeout := 15 * time.Second
		if call.Name == "delegate_to_agent" {
			timeout = 120 * time.Second
		}
		callCtx, cancel := context.WithTimeout(ctx, timeout)

		var in ToolInput
		if err := json.Unmarshal(call.ArgsJSON, &in); err != nil {
			cancel()
			results = append(results, makeErrorResult(call, fmt.Sprintf("invalid arguments: %v", err)))
			continue
		}
		// 移除 confirm 字段，避免传入工具实现
		delete(in, "confirm")

		res, err := e.registry.Execute(callCtx, call.Name, p, in)
		cancel()
		if err != nil {
			results = append(results, makeErrorResult(call, fmt.Sprintf("tool execution error: %v", err)))
			continue
		}

		output, _ := json.Marshal(res)
		results = append(results, ToolCallResult{
			ToolCallID: call.ID,
			Name:       call.Name,
			Output:     string(output),
			Display:    res.Display,
			OK:         res.OK,
		})

		if err := ctx.Err(); err != nil {
			return results, err
		}
	}
	return results, nil
}

// handleConfirmation 处理写操作的二次确认。
// 返回 (confirmed, msg, intercepted)：
//   - intercepted=true: 已生成 pending token，应作为"请用户确认"结果返回（不要执行）
//   - intercepted=false, confirmed=true: token 校验通过，应真正执行
//   - intercepted=false, confirmed=false: token 无效，应作为错误返回
func (e *ToolExecutor) handleConfirmation(call ToolCall, p Principal) (bool, string, bool) {
	// 解析原始参数
	var raw map[string]any
	if err := json.Unmarshal(call.ArgsJSON, &raw); err != nil {
		return false, fmt.Sprintf("invalid arguments: %v", err), false
	}

	confirmVal, _ := raw["confirm"].(string)
	// 计算参数指纹：去除 confirm 字段后重新序列化（保证两次调用可比对）
	delete(raw, "confirm")
	fingerprintBytes, _ := json.Marshal(raw)
	fingerprint := string(fingerprintBytes)

	if confirmVal == "" {
		// 第一次调用：生成 token，要求确认
		e.conf.Cleanup()
		token, err := e.conf.Create(call.Name, fingerprint, p)
		if err != nil {
			return false, fmt.Sprintf("failed to issue confirmation token: %v", err), false
		}
		msg := fmt.Sprintf(
			"This is a write operation (%s). To prevent accidental execution, "+
				"please ask the user to confirm. "+
				"If the user confirms, call this tool again with the SAME arguments "+
				"plus confirm=%q. Do not change any other parameter values.",
			call.Name, token,
		)
		return false, msg, true
	}

	// 第二次调用：校验 token
	ok, errMsg := e.conf.Consume(confirmVal, call.Name, fingerprint, p)
	if !ok {
		return false, "confirmation failed: " + errMsg, false
	}
	return true, "", false
}

func toJSONString(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

// ToolMessage 表示 LLM history 中的 "tool" role 消息。
type ToolMessage struct {
	Role       string `json:"role"` // always "tool"
	Content    string `json:"content"`
	ToolCallID string `json:"tool_call_id"`
}

func (r ToolCallResult) ToMessage() ToolMessage {
	return ToolMessage{
		Role:       "tool",
		Content:    r.Output,
		ToolCallID: r.ToolCallID,
	}
}

// SummarizeDisplay 把多次工具调用的 Display 合并为给前端的卡片列表。
func SummarizeDisplay(results []ToolCallResult) []ToolDisplay {
	out := make([]ToolDisplay, 0, len(results))
	for _, r := range results {
		if r.Display != nil {
			out = append(out, *r.Display)
		}
	}
	return out
}

func makeErrorResult(call ToolCall, msg string) ToolCallResult {
	output, _ := json.Marshal(ToolResult{OK: false, Error: msg})
	return ToolCallResult{
		ToolCallID: call.ID,
		Name:       call.Name,
		Output:     string(output),
		OK:         false,
	}
}

func toSet(items []string) map[string]bool {
	m := make(map[string]bool, len(items))
	for _, i := range items {
		m[i] = true
	}
	return m
}
