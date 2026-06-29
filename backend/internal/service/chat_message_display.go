package service

import (
	"encoding/json"
	"strings"

	"github.com/wanye/ideaevo/internal/model"
)

const (
	displayKindLLMOnly  = "llm_only"
	displayKindActivity = "activity"
)

// messageMeta 是 ChatMessage.Metadata 的统一结构。
type messageMeta struct {
	DisplayKind string         `json:"display_kind,omitempty"`
	ToolCalls   []ToolCall     `json:"tool_calls,omitempty"`
	ToolCallID  string         `json:"tool_call_id,omitempty"`
	ToolName    string         `json:"tool_name,omitempty"`
	Activity    map[string]any `json:"activity,omitempty"`
}

func parseMessageMeta(raw string) messageMeta {
	if raw == "" || raw == "{}" {
		return messageMeta{}
	}
	var meta messageMeta
	_ = json.Unmarshal([]byte(raw), &meta)
	return meta
}

func marshalMessageMeta(meta messageMeta) string {
	b, err := json.Marshal(meta)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// mergeActivityMaps 合并 activity 字段，新值覆盖同 key，保留 tool_call 阶段写入的上下文。
func mergeActivityMaps(existing, update map[string]any) map[string]any {
	if len(existing) == 0 {
		if update == nil {
			return map[string]any{}
		}
		out := make(map[string]any, len(update))
		for k, v := range update {
			out[k] = v
		}
		return out
	}
	out := make(map[string]any, len(existing)+len(update))
	for k, v := range existing {
		out[k] = v
	}
	for k, v := range update {
		out[k] = v
	}
	return out
}

// isMessageVisibleInUI 判断消息是否应出现在用户聊天历史列表中。
func isMessageVisibleInUI(m model.ChatMessage) bool {
	if m.Role == model.MessageRoleTool {
		return false
	}
	meta := parseMessageMeta(m.Metadata)
	if meta.DisplayKind == displayKindLLMOnly {
		return false
	}
	// 空的 assistant 行（仅 tool_calls）不展示
	if m.Role == model.MessageRoleAssistant && strings.TrimSpace(m.Content) == "" && len(meta.ToolCalls) > 0 {
		return false
	}
	return true
}

// filterVisibleMessages 从按 created_at DESC 排列的批次中取出最多 limit 条 UI 可见消息。
func filterVisibleMessages(messages []model.ChatMessage, limit int) []model.ChatMessage {
	visible := make([]model.ChatMessage, 0, limit)
	for _, m := range messages {
		if isMessageVisibleInUI(m) {
			visible = append(visible, m)
			if len(visible) >= limit {
				break
			}
		}
	}
	return visible
}

func buildToolCallActivityContent(toolName, targetAgentName string) string {
	if toolName == "delegate_to_agent" {
		name := targetAgentName
		if name == "" {
			name = "Agent"
		}
		return "🔗 正在与 " + name + " 通信…"
	}
	return "正在调用工具：" + toolName + "…"
}

func buildToolResultActivityContent(toolName, targetAgentName string, ok bool, responseSummary string) string {
	prefix := "✗"
	if ok {
		prefix = "✓"
	}
	if toolName == "delegate_to_agent" {
		name := targetAgentName
		if name == "" {
			name = "Agent"
		}
		if ok && responseSummary != "" {
			return prefix + " " + name + " 回复：" + responseSummary
		}
		return prefix + " " + name + " 通信完成"
	}
	return prefix + " " + toolName + " 完成"
}
