package service

import (
	"fmt"
	"strings"

	"github.com/wanye/ideaevo/internal/model"
)

const (
	retrievalQueryMaxRunes = 500
	ragDescriptionExcerpt  = 200
	userIdeaRAGLimit       = 8
	userIdeaRAGThreshold   = 0.35
	globalIdeaRAGLimit     = 5
	globalIdeaRAGThreshold = 0.50
	exploreGlobalLimit     = 3
	exploreGlobalThreshold = 0.55
	highSimilarityWarning  = 0.75
)

// IdeaContextBundle 是注入 system prompt 的检索结果。
type IdeaContextBundle struct {
	UserIdeas   []IdeaMatch
	GlobalIdeas []IdeaMatch
	QueryText   string
}

// IdeaContextRetriever 统一 idea 向量检索（聊天 RAG 与创建场景）。
type IdeaContextRetriever struct {
	searcher SimilaritySearcher
	embed    *EmbeddingService
	ideaSvc  *IdeaService
}

func NewIdeaContextRetriever(searcher SimilaritySearcher, embed *EmbeddingService, ideaSvc *IdeaService) *IdeaContextRetriever {
	return &IdeaContextRetriever{
		searcher: searcher,
		embed:    embed,
		ideaSvc:  ideaSvc,
	}
}

func (r *IdeaContextRetriever) Enabled() bool {
	return r != nil && r.searcher != nil && r.embed != nil && r.embed.Enabled()
}

// Retrieve 按用户目标检索自有 idea 与全站参考 idea。
func (r *IdeaContextRetriever) Retrieve(session *model.ChatSession, userMessage string, history []LLMMessage) (*IdeaContextBundle, error) {
	if !r.Enabled() || session == nil {
		return nil, nil
	}

	query := buildRetrievalQuery(session, userMessage, history, r.ideaSvc)
	if query == "" {
		return nil, nil
	}

	bundle := &IdeaContextBundle{QueryText: query}
	seen := make(map[string]bool)
	excludeID := ""
	if session.IdeaID != nil {
		excludeID = *session.IdeaID
		seen[excludeID] = true
	}

	if session.UserID != "" {
		matches, err := r.searcher.Search(query, SearchOptions{
			OwnerUserID: session.UserID,
			Threshold:   userIdeaRAGThreshold,
			Limit:       userIdeaRAGLimit,
		})
		if err == nil {
			for _, m := range matches {
				if seen[m.Idea.ID] {
					continue
				}
				bundle.UserIdeas = append(bundle.UserIdeas, m)
				seen[m.Idea.ID] = true
			}
		}
	}

	globalMatches, err := r.searcher.Search(query, SearchOptions{
		Status:    "active",
		Threshold: globalIdeaRAGThreshold,
		Limit:     globalIdeaRAGLimit,
	})
	if err == nil {
		for _, m := range globalMatches {
			if seen[m.Idea.ID] {
				continue
			}
			bundle.GlobalIdeas = append(bundle.GlobalIdeas, m)
			seen[m.Idea.ID] = true
		}
	}

	if len(bundle.UserIdeas) == 0 && len(bundle.GlobalIdeas) == 0 {
		return bundle, nil
	}
	return bundle, nil
}

// RetrieveExplore 探索意图：仅检索全站相似 active idea。
func (r *IdeaContextRetriever) RetrieveExplore(session *model.ChatSession, userMessage string, history []LLMMessage) (*IdeaContextBundle, error) {
	if !r.Enabled() || session == nil {
		return nil, nil
	}
	query := buildRetrievalQuery(session, userMessage, history, r.ideaSvc)
	if query == "" {
		return nil, nil
	}
	matches, err := r.searcher.Search(query, SearchOptions{
		Status:    "active",
		Threshold: exploreGlobalThreshold,
		Limit:     exploreGlobalLimit,
	})
	if err != nil {
		return nil, err
	}
	excludeID := ""
	if session.IdeaID != nil {
		excludeID = *session.IdeaID
	}
	filtered := make([]IdeaMatch, 0, len(matches))
	for _, m := range matches {
		if m.Idea.ID == excludeID {
			continue
		}
		filtered = append(filtered, m)
	}
	return &IdeaContextBundle{QueryText: query, GlobalIdeas: filtered}, nil
}

// RetrievePortfolioFallback 向量不可用时，用 MySQL 列出用户最近 active idea。
func (r *IdeaContextRetriever) RetrievePortfolioFallback(session *model.ChatSession) (*IdeaContextBundle, error) {
	if r == nil || r.ideaSvc == nil || session == nil || session.UserID == "" {
		return nil, nil
	}
	ideas, _, err := r.ideaSvc.Query(QueryFilter{
		OwnerUserID: session.UserID,
		Status:      "active",
		Limit:       userIdeaRAGLimit,
		Sort:        "newest",
	})
	if err != nil {
		return nil, err
	}
	if len(ideas) == 0 {
		return &IdeaContextBundle{}, nil
	}
	matches := make([]IdeaMatch, len(ideas))
	for i, idea := range ideas {
		matches[i] = IdeaMatch{Idea: idea, Similarity: 0}
	}
	return &IdeaContextBundle{UserIdeas: matches}, nil
}

func buildRetrievalQuery(session *model.ChatSession, userMessage string, history []LLMMessage, ideaSvc *IdeaService) string {
	var parts []string

	if session != nil && session.IdeaID != nil && *session.IdeaID != "" && ideaSvc != nil {
		if idea, err := ideaSvc.GetByID(*session.IdeaID); err == nil {
			parts = append(parts, idea.Title, idea.Description)
		}
	}

	parts = append(parts, strings.TrimSpace(userMessage))

	userTurns := 0
	for i := len(history) - 1; i >= 0 && userTurns < 3; i-- {
		if history[i].Role != "user" {
			continue
		}
		content := strings.TrimSpace(history[i].Content)
		if content != "" && content != strings.TrimSpace(userMessage) {
			parts = append(parts, content)
			userTurns++
		}
	}

	query := strings.Join(parts, "\n")
	return truncateRunes(query, retrievalQueryMaxRunes)
}

func truncateRunes(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max])
}

const ideaCreationGuidelines = `

## 创建/完善 idea 时的指引
- 参考上方检索到的用户自有 idea，说明与它们的差异，避免重复题；若相似度很高，询问用户是否扩展现有 idea 而非新建。
- 引用全站相似 idea 时可建议 fork/致敬，不要抄袭描述。
- 生成结构化草稿（标题/描述/分类）前，可调用 search_ideas(scope=mine) 再次确认用户 portfolio。
- 用户确认后使用 register_idea 发布；系统会自动检测高度相似的重复 idea。`

// FormatIdeaContextSection 把检索结果格式化为 system prompt 片段。
func FormatIdeaContextSection(bundle *IdeaContextBundle) string {
	if bundle == nil {
		return ""
	}
	var section string
	if len(bundle.UserIdeas) > 0 {
		section += "\n\n## 该用户已发布的相关想法（创建时优先参考、避免重复）："
		for i, m := range bundle.UserIdeas {
			section += formatRAGIdeaLineDetailed(i+1, m)
		}
	}
	if len(bundle.GlobalIdeas) > 0 {
		section += "\n\n## 平台中其他相似想法（可供对比、致敬）："
		for i, m := range bundle.GlobalIdeas {
			section += formatRAGIdeaLineDetailed(i+1, m)
		}
	}
	if section == "" {
		return ""
	}
	section += ideaCreationGuidelines
	if hasHighSimilarityOwnIdea(bundle) {
		section += "\n- 注意：用户自有 idea 中存在高相似度条目（>0.75），请主动提醒是否合并或差异化。"
	}
	return section
}

const ideaExploreGuidelines = `

## 探索 idea 时的指引
- 上方为语义检索到的相似想法；也可调用 search_ideas 获取更新结果。
- 用自然语言总结异同，引导用户 fork 或继续深入讨论。`

// FormatExploreContextSection 探索意图的轻量 RAG 片段。
func FormatExploreContextSection(bundle *IdeaContextBundle) string {
	if bundle == nil || len(bundle.GlobalIdeas) == 0 {
		return exploreSearchToolHint
	}
	section := "\n\n## 平台中相似想法（供发现与对比）："
	for i, m := range bundle.GlobalIdeas {
		section += formatRAGIdeaLineDetailed(i+1, m)
	}
	return section + ideaExploreGuidelines
}

const exploreSearchToolHint = `

## 探索 idea
- 向量检索暂不可用或未命中结果时，请调用 search_ideas 帮用户发现相关想法。`

// FormatPortfolioFallbackSection 向量降级：仅用户 portfolio 列表。
func FormatPortfolioFallbackSection(bundle *IdeaContextBundle) string {
	if bundle == nil || len(bundle.UserIdeas) == 0 {
		return ""
	}
	section := "\n\n## 该用户已发布的想法（列表降级，非语义排序）："
	for i, m := range bundle.UserIdeas {
		section += formatRAGIdeaLineDetailed(i+1, m)
	}
	return section + ideaCreationGuidelines
}

func formatRAGIdeaLineDetailed(n int, m IdeaMatch) string {
	desc := truncate(m.Idea.Description, ragDescriptionExcerpt)
	line := fmt.Sprintf("\n%d. [id=%s sim=%.2f] 【%s】%s", n, m.Idea.ID, m.Similarity, m.Idea.Title, desc)
	if m.Idea.Category != "" {
		line += fmt.Sprintf("（分类：%s）", m.Idea.Category)
	}
	return line
}

func hasHighSimilarityOwnIdea(bundle *IdeaContextBundle) bool {
	for _, m := range bundle.UserIdeas {
		if m.Similarity >= highSimilarityWarning {
			return true
		}
	}
	return false
}
