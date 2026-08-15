package service

import (
	"strings"

	"github.com/wanye/ideaevo/internal/model"
)

// IdeaChatIntent 表示用户在聊天中与 idea 相关的意图。
type IdeaChatIntent int

const (
	IdeaIntentNone IdeaChatIntent = iota
	IdeaIntentExplore
	IdeaIntentCreateOrRefine
)

var createIdeaKeywords = []string{
	"创建", "注册", "发布", "写一个想法", "写个想法", "起一个标题", "起标题",
	"完善描述", "改描述", "改标题", "起草", "帮我写", "我的想法", "新想法",
	"做一个", "想一个", "想个", "点子", "构想", "产品想法", "产品idea",
	"idea", "register", "publish", "create idea", "new idea", "draft",
}

// exploreIdeaKeywords 使用多字短语，避免单字「找」误伤日常用语。
var exploreIdeaKeywords = []string{
	"找一下", "找找", "搜索", "搜一搜", "搜一", "类似", "有没有", "发现", "推荐",
	"browse", "search for", "find similar", "discover",
}

// DetectIdeaIntent 用轻量启发式判断当前轮是否应加强 idea 向量检索。
func DetectIdeaIntent(session *model.ChatSession, userMessage string, history []LLMMessage) IdeaChatIntent {
	text := strings.ToLower(strings.TrimSpace(userMessage))
	if text == "" {
		return IdeaIntentNone
	}

	// 已绑定 idea 的会话：默认视为完善/讨论该 idea（探索意图除外）。
	if session != nil && session.IdeaID != nil && *session.IdeaID != "" {
		if matchesKeywords(text, exploreIdeaKeywords) {
			return IdeaIntentExplore
		}
		return IdeaIntentCreateOrRefine
	}

	if matchesKeywords(text, createIdeaKeywords) || looksLikeRefinement(text) {
		return IdeaIntentCreateOrRefine
	}

	for i := len(history) - 1; i >= 0 && i >= len(history)-6; i-- {
		if history[i].Role != "user" {
			continue
		}
		prev := strings.ToLower(history[i].Content)
		if matchesKeywords(prev, createIdeaKeywords) || looksLikeRefinement(prev) {
			return IdeaIntentCreateOrRefine
		}
	}

	if matchesKeywords(text, exploreIdeaKeywords) {
		return IdeaIntentExplore
	}
	return IdeaIntentNone
}

func matchesKeywords(text string, keywords []string) bool {
	for _, kw := range keywords {
		if strings.Contains(text, strings.ToLower(kw)) {
			return true
		}
	}
	return false
}

func looksLikeRefinement(text string) bool {
	refineHints := []string{"描述", "标题", "分类", "标签", "改成", "换成", "补充", "优化"}
	for _, h := range refineHints {
		if strings.Contains(text, h) {
			return true
		}
	}
	return false
}
