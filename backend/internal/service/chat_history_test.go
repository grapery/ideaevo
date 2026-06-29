package service

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/wanye/ideaevo/internal/model"
)

// TestChatMessageToLLMMessage_RoundTrip_AssistantToolCalls 验证带 tool_calls 的
// assistant 消息能正确序列化进 Metadata 并由 chatMessageToLLMMessage 还原，
// 使两步确认等流程在重建历史时仍能看到 LLM 上轮的工具调用决策。
func TestChatMessageToLLMMessage_RoundTrip_AssistantToolCalls(t *testing.T) {
	toolCalls := []ToolCall{
		{ID: "call_1", Name: "register_idea", ArgsJSON: json.RawMessage(`{"title":"X"}`)},
	}
	// 构造 assistant(tool_calls) 行（模拟 newToolCallAssistantMessage 的产出）
	meta, _ := json.Marshal(messageMeta{ToolCalls: toolCalls})
	row := model.ChatMessage{
		Role:     model.MessageRoleAssistant,
		Content:  "",
		Metadata: string(meta),
	}

	got := chatMessageToLLMMessage(row)
	if len(got.ToolCalls) != 1 {
		t.Fatalf("want 1 tool call restored, got %d", len(got.ToolCalls))
	}
	if got.ToolCalls[0].ID != "call_1" || got.ToolCalls[0].Name != "register_idea" {
		t.Errorf("restored tool_call mismatch: %+v", got.ToolCalls[0])
	}
	if string(got.ToolCalls[0].ArgsJSON) != `{"title":"X"}` {
		t.Errorf("args mismatch: %s", got.ToolCalls[0].ArgsJSON)
	}
}

// TestChatMessageToLLMMessage_RoundTrip_ToolResult 验证 tool 结果消息
// （role=tool + tool_call_id + name）的序列化/还原。
func TestChatMessageToLLMMessage_RoundTrip_ToolResult(t *testing.T) {
	meta, _ := json.Marshal(messageMeta{ToolCallID: "call_1", ToolName: "register_idea"})
	row := model.ChatMessage{
		Role:     model.MessageRoleTool,
		Content:  `{"ok":true}`,
		Metadata: string(meta),
	}

	got := chatMessageToLLMMessage(row)
	if got.Role != "tool" {
		t.Errorf("role=%q want tool", got.Role)
	}
	if got.ToolCallID != "call_1" {
		t.Errorf("tool_call_id=%q want call_1", got.ToolCallID)
	}
	if got.ToolName != "register_idea" {
		t.Errorf("tool_name=%q want register_idea", got.ToolName)
	}
	if got.Content != `{"ok":true}` {
		t.Errorf("content=%q", got.Content)
	}
}

// TestChatMessageToLLMMessage_EmptyMetadata 验证普通 user/assistant 文本消息
// （无 tool 相关字段）不受影响。
func TestChatMessageToLLMMessage_EmptyMetadata(t *testing.T) {
	for _, meta := range []string{"", "{}"} {
		got := chatMessageToLLMMessage(model.ChatMessage{Role: "user", Content: "hi", Metadata: meta})
		if len(got.ToolCalls) != 0 || got.ToolCallID != "" || got.ToolName != "" {
			t.Errorf("plain message should have no tool fields, got %+v (meta=%q)", got, meta)
		}
		if got.Role != "user" || got.Content != "hi" {
			t.Errorf("plain message fields lost: %+v", got)
		}
	}
}

// TestTwoStepConfirmation_AcrossSimulatedRequests 模拟完整的跨请求流程：
//  1. 第 1 轮：LLM 调 register_idea（无 confirm）→ 拿到 token
//  2. 把 assistant(tool_calls) 和 tool 结果"持久化"为 ChatMessage 行
//  3. 用 chatMessageToLLMMessage 重建出 LLM history（模拟第 2 轮请求的 buildMessageHistory）
//  4. 第 2 轮：基于重建的历史，LLM 带 confirm=token 再次调用 → 应真正执行
//
// 这覆盖了本次修复的核心：tool-use 历史经过持久化往返后，确认 token 仍可用。
func TestTwoStepConfirmation_AcrossSimulatedRequests(t *testing.T) {
	var executed bool
	exec := newWriteToolExecutor(t, &executed)
	p := Principal{AgentID: "agent-A"}

	// —— 第 1 轮：发起 register_idea，拿到 confirmation token ——
	args1, _ := json.Marshal(map[string]any{"title": "我的新想法", "description": "d", "category": "tool"})
	call1 := ToolCall{ID: "call_1", Name: "register_idea", ArgsJSON: args1}
	res1, err := exec.ExecuteBatch(context.Background(), p, []ToolCall{call1})
	if err != nil {
		t.Fatalf("round1 ExecuteBatch err: %v", err)
	}
	if res1[0].OK {
		t.Fatal("round1 should be intercepted (need_confirmation), not executed")
	}
	token := extractConfirmToken(t, res1[0].Output)
	if token == "" {
		t.Fatal("could not extract confirmation token from round1 output")
	}

	// —— 模拟持久化 + 重建历史（chat_service 里由 newToolCallAssistantMessage /
	//    newToolResultMessage 落库，buildMessageHistory 用 chatMessageToLLMMessage 还原）——
	tcMeta, _ := json.Marshal(messageMeta{ToolCalls: []ToolCall{call1}})
	assistantRow := model.ChatMessage{Role: model.MessageRoleAssistant, Metadata: string(tcMeta)}
	trMeta, _ := json.Marshal(messageMeta{ToolCallID: "call_1", ToolName: "register_idea"})
	toolRow := model.ChatMessage{Role: model.MessageRoleTool, Content: res1[0].Output, Metadata: string(trMeta)}

	rebuiltHistory := []LLMMessage{
		chatMessageToLLMMessage(assistantRow), // → role=assistant, tool_calls=[call_1]
		chatMessageToLLMMessage(toolRow),      // → role=tool, tool_call_id=call_1
	}
	// 断言重建后 LLM 能看到上轮的 tool_call（参数指纹必须与首次一致，token 才能被消费）
	if len(rebuiltHistory[0].ToolCalls) != 1 {
		t.Fatalf("rebuilt history lost tool_calls: %+v", rebuiltHistory[0])
	}
	restoredCall := rebuiltHistory[0].ToolCalls[0]
	if string(restoredCall.ArgsJSON) != string(args1) {
		t.Errorf("restored args drifted: %s vs %s", restoredCall.ArgsJSON, args1)
	}

	// —— 第 2 轮：LLM 基于历史，用相同参数 + confirm=token 再次调用 → 应执行 ——
	args2, _ := json.Marshal(map[string]any{
		"title":       "我的新想法",
		"description": "d",
		"category":    "tool",
		"confirm":     token,
	})
	call2 := ToolCall{ID: "call_2", Name: "register_idea", ArgsJSON: args2}
	res2, err := exec.ExecuteBatch(context.Background(), p, []ToolCall{call2})
	if err != nil {
		t.Fatalf("round2 ExecuteBatch err: %v", err)
	}
	if !res2[0].OK {
		t.Fatalf("round2 should succeed after confirmation, got: %s", res2[0].Output)
	}
	if !executed {
		t.Error("tool should have been executed in round2 (idea must be persisted)")
	}
}

// TestTwoStepConfirmation_HistoryLostBreaksConfirm 反向验证：若历史丢失
// （旧行为 —— tool 消息不持久化，LLM 看不到上轮 token），第 2 轮确认会失败。
// 这正是修复前用户遇到的"聊天创建的 idea 不出现"的根因。
func TestTwoStepConfirmation_HistoryLostBreaksConfirm(t *testing.T) {
	var executed bool
	exec := newWriteToolExecutor(t, &executed)
	p := Principal{AgentID: "agent-A"}

	args1, _ := json.Marshal(map[string]any{"title": "X", "description": "d", "category": "tool"})
	res1, _ := exec.ExecuteBatch(context.Background(), p, []ToolCall{
		{ID: "call_1", Name: "register_idea", ArgsJSON: args1},
	})
	token := extractConfirmToken(t, res1[0].Output)

	// 模拟"历史丢失"：LLM 在第 2 轮编造了一个错误的 token（因为看不到真实 token）
	wrongToken := strings.Repeat("0", len(token))
	args2, _ := json.Marshal(map[string]any{
		"title": "X", "description": "d", "category": "tool", "confirm": wrongToken,
	})
	res2, _ := exec.ExecuteBatch(context.Background(), p, []ToolCall{
		{ID: "call_2", Name: "register_idea", ArgsJSON: args2},
	})
	if res2[0].OK {
		t.Error("with wrong/lost token, confirmation must fail (idea should NOT be created)")
	}
	if executed {
		t.Error("tool must not execute with an invalid token")
	}
}
