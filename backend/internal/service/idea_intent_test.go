package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/wanye/ideaevo/internal/model"
)

func TestDetectIdeaIntent_Create(t *testing.T) {
	intent := DetectIdeaIntent(&model.ChatSession{}, "帮我注册一个新想法", nil)
	assert.Equal(t, IdeaIntentCreateOrRefine, intent)
}

func TestDetectIdeaIntent_BoundIdeaRefine(t *testing.T) {
	ideaID := "idea-1"
	intent := DetectIdeaIntent(&model.ChatSession{IdeaID: &ideaID}, "把描述改得更清楚一点", nil)
	assert.Equal(t, IdeaIntentCreateOrRefine, intent)
}

func TestDetectIdeaIntent_ColloquialCreate(t *testing.T) {
	intent := DetectIdeaIntent(&model.ChatSession{}, "我想做一个 AI 笔记 App", nil)
	assert.Equal(t, IdeaIntentCreateOrRefine, intent)
}

func TestDetectIdeaIntent_BoundSessionDefaultRefine(t *testing.T) {
	ideaID := "idea-1"
	intent := DetectIdeaIntent(&model.ChatSession{IdeaID: &ideaID}, "继续聊聊这个功能", nil)
	assert.Equal(t, IdeaIntentCreateOrRefine, intent)
}

func TestDetectIdeaIntent_Explore(t *testing.T) {
	intent := DetectIdeaIntent(&model.ChatSession{}, "帮我找类似的 AI 工具想法", nil)
	assert.Equal(t, IdeaIntentExplore, intent)
}

func TestDetectIdeaIntent_None(t *testing.T) {
	intent := DetectIdeaIntent(&model.ChatSession{}, "今天天气怎么样", nil)
	assert.Equal(t, IdeaIntentNone, intent)
}

func TestDetectIdeaIntent_HistoryCreate(t *testing.T) {
	history := []LLMMessage{
		{Role: "user", Content: "我想发布一个想法"},
		{Role: "assistant", Content: "好的，请说说具体内容"},
	}
	intent := DetectIdeaIntent(&model.ChatSession{}, "面向开发者的笔记工具", history)
	assert.Equal(t, IdeaIntentCreateOrRefine, intent)
}

func TestBuildRetrievalQuery_IncludesHistory(t *testing.T) {
	session := &model.ChatSession{}
	history := []LLMMessage{
		{Role: "user", Content: "第一轮：AI 写作助手"},
	}
	q := buildRetrievalQuery(session, "完善标题", history, nil)
	assert.Contains(t, q, "完善标题")
	assert.Contains(t, q, "第一轮")
}

func TestTruncateRunes(t *testing.T) {
	out := truncateRunes("一二三四五", 3)
	assert.Equal(t, "一二三", out)
}

func TestFormatIdeaContextSection_Empty(t *testing.T) {
	assert.Equal(t, "", FormatIdeaContextSection(&IdeaContextBundle{}))
}

func TestFormatIdeaContextSection_WithMatches(t *testing.T) {
	section := FormatIdeaContextSection(&IdeaContextBundle{
		UserIdeas: []IdeaMatch{{
			Idea:       model.Idea{ID: "a1", Title: "T", Description: "D", Category: "tool"},
			Similarity: 0.9,
		}},
	})
	assert.Contains(t, section, "id=a1")
	assert.Contains(t, section, "创建/完善 idea")
}

func TestHasHighSimilarityOwnIdea(t *testing.T) {
	assert.True(t, hasHighSimilarityOwnIdea(&IdeaContextBundle{
		UserIdeas: []IdeaMatch{{Similarity: 0.8}},
	}))
	assert.False(t, hasHighSimilarityOwnIdea(&IdeaContextBundle{
		UserIdeas: []IdeaMatch{{Similarity: 0.5}},
	}))
}
