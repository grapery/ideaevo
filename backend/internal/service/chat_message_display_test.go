package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/wanye/ideaevo/internal/model"
)

func TestIsMessageVisibleInUI(t *testing.T) {
	t.Run("tool role hidden", func(t *testing.T) {
		assert.False(t, isMessageVisibleInUI(model.ChatMessage{Role: model.MessageRoleTool}))
	})

	t.Run("llm_only assistant hidden", func(t *testing.T) {
		assert.False(t, isMessageVisibleInUI(model.ChatMessage{
			Role:     model.MessageRoleAssistant,
			Metadata: marshalMessageMeta(messageMeta{DisplayKind: displayKindLLMOnly}),
		}))
	})

	t.Run("empty assistant with tool_calls hidden", func(t *testing.T) {
		assert.False(t, isMessageVisibleInUI(model.ChatMessage{
			Role:     model.MessageRoleAssistant,
			Content:  "",
			Metadata: marshalMessageMeta(messageMeta{ToolCalls: []ToolCall{{ID: "tc1", Name: "search_ideas"}}}),
		}))
	})

	t.Run("activity system visible", func(t *testing.T) {
		assert.True(t, isMessageVisibleInUI(model.ChatMessage{
			Role:     model.MessageRoleSystem,
			Content:  "正在调用工具：search_ideas…",
			Metadata: marshalMessageMeta(messageMeta{DisplayKind: displayKindActivity}),
		}))
	})

	t.Run("final assistant visible", func(t *testing.T) {
		assert.True(t, isMessageVisibleInUI(model.ChatMessage{
			Role:    model.MessageRoleAssistant,
			Content: "hello",
		}))
	})

	t.Run("user visible", func(t *testing.T) {
		assert.True(t, isMessageVisibleInUI(model.ChatMessage{Role: "user", Content: "hi"}))
	})
}

func TestMergeActivityMaps(t *testing.T) {
	existing := map[string]any{
		"type":              "tool_call",
		"is_a2a":            true,
		"target_agent_name": "万叶助手",
		"task":              "summarize",
	}
	update := map[string]any{
		"type": "tool_result",
		"ok":   false,
	}
	merged := mergeActivityMaps(existing, update)
	assert.Equal(t, "tool_result", merged["type"])
	assert.Equal(t, false, merged["ok"])
	assert.Equal(t, true, merged["is_a2a"])
	assert.Equal(t, "万叶助手", merged["target_agent_name"])
	assert.Equal(t, "summarize", merged["task"])
}

func TestFilterVisibleMessages(t *testing.T) {
	batch := []model.ChatMessage{
		{Role: model.MessageRoleAssistant, Metadata: marshalMessageMeta(messageMeta{DisplayKind: displayKindLLMOnly})},
		{Role: model.MessageRoleSystem, Content: "tool", Metadata: marshalMessageMeta(messageMeta{DisplayKind: displayKindActivity})},
		{Role: model.MessageRoleUser, Content: "hi"},
		{Role: model.MessageRoleTool, Content: "{}"},
	}
	got := filterVisibleMessages(batch, 2)
	assert.Len(t, got, 2)
	assert.Equal(t, model.MessageRoleSystem, got[0].Role)
	assert.Equal(t, model.MessageRoleUser, got[1].Role)
}

func TestBuildToolCallActivityContent(t *testing.T) {
	assert.Equal(t, "正在调用工具：search_ideas…", buildToolCallActivityContent("search_ideas", ""))
	assert.Equal(t, "🔗 正在与 万叶助手 通信…", buildToolCallActivityContent("delegate_to_agent", "万叶助手"))
}

func TestChatMessageToLLMMessage_RestoresToolCalls(t *testing.T) {
	m := model.ChatMessage{
		Role:     model.MessageRoleAssistant,
		Content:  "",
		Metadata: marshalMessageMeta(messageMeta{
			DisplayKind: displayKindLLMOnly,
			ToolCalls:   []ToolCall{{ID: "call-1", Name: "search_ideas", ArgsJSON: []byte(`{}`)}},
		}),
	}
	llm := chatMessageToLLMMessage(m)
	assert.Len(t, llm.ToolCalls, 1)
	assert.Equal(t, "search_ideas", llm.ToolCalls[0].Name)
}
