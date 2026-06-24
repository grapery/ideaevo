package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/wanye/ideaevo/internal/model"
)

// ---- shared JSON schema fragments ----

// rawJSON 把 Go map/struct 编码为 json.RawMessage（用于 Parameters()）。
// 失败几乎不可能（静态结构），故 panic。
func rawJSON(v any) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		panic(fmt.Sprintf("invalid tool schema: %v", err))
	}
	return b
}

// commonStringProp 构造 {"type":"string","description":...} 片段。
func stringProp(desc string) map[string]any {
	return map[string]any{"type": "string", "description": desc}
}

func stringEnumProp(desc string, values ...string) map[string]any {
	return map[string]any{"type": "string", "description": desc, "enum": values}
}

func numberProp(desc string) map[string]any {
	return map[string]any{"type": "number", "description": desc}
}

func arrayStringProp(desc string) map[string]any {
	return map[string]any{
		"type":        "array",
		"description": desc,
		"items":       map[string]any{"type": "string"},
	}
}

// requiredProp 标记必填字段名。
func requiredProp() []string { return []string{"_"} } // unused placeholder

// =====================================================================
// 查询/检索类工具
// =====================================================================

// SearchIdeasTool 语义搜索 idea（向量检索优先，MySQL LIKE 降级）。
type SearchIdeasTool struct {
	ideaSvc *IdeaService
}

func NewSearchIdeasTool(ideaSvc *IdeaService) *SearchIdeasTool {
	return &SearchIdeasTool{ideaSvc: ideaSvc}
}

func (t *SearchIdeasTool) Name() string { return "search_ideas" }
func (t *SearchIdeasTool) Description() string {
	return "Search the marketplace for ideas matching a natural-language query. " +
		"Use this when the user asks to find/discover/explore ideas, or wants similar ideas. " +
		"Returns ranked matches with title, description, category, and stats."
}
func (t *SearchIdeasTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"query":     stringProp("Natural-language search query, e.g. 'AI productivity tools' or '有意思的想法'"),
			"threshold": numberProp("Similarity threshold 0-1. Lower = more results. Default 0.3"),
			"limit":     numberProp("Max results (default 10, max 30)"),
		},
		"required": []string{"query"},
	})
}
func (t *SearchIdeasTool) Execute(ctx context.Context, _ Principal, in ToolInput) (*ToolResult, error) {
	query, err := ToolStrReq(in, "query")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	threshold := ToolFloat(in, "threshold")
	limit := ToolInt(in, "limit")
	if limit == 0 {
		limit = 10
	}
	matches, err := t.ideaSvc.Search(query, threshold, limit)
	if err != nil {
		return nil, fmt.Errorf("search_ideas failed: %w", err)
	}

	// 只把对 LLM 有用的字段传出，避免 prompt 过长
	summaries := make([]map[string]any, 0, len(matches))
	for _, m := range matches {
		summaries = append(summaries, map[string]any{
			"id":         m.Idea.ID,
			"title":      m.Idea.Title,
			"category":   m.Idea.Category,
			"status":     string(m.Idea.Status),
			"like_count": m.Idea.LikeCount,
			"excerpt":    truncate(m.Idea.Description, 200),
			"similarity": m.Similarity,
		})
	}

	return &ToolResult{
		OK:   true,
		Data: map[string]any{"results": summaries, "count": len(summaries)},
		Display: &ToolDisplay{
			Kind: "idea_list",
			Ref:  summarizeIDs(matches),
		},
	}, nil
}

// QueryIdeasTool 按条件列表 idea（不依赖语义匹配，按状态/分类/排序）。
type QueryIdeasTool struct {
	ideaSvc *IdeaService
}

func NewQueryIdeasTool(ideaSvc *IdeaService) *QueryIdeasTool {
	return &QueryIdeasTool{ideaSvc: ideaSvc}
}

func (t *QueryIdeasTool) Name() string { return "query_ideas" }
func (t *QueryIdeasTool) Description() string {
	return "List ideas by filter (status/category/sort). Use for browsing 'popular', 'newest', " +
		"'most forked' ideas, or filtering by category. Does NOT do semantic search."
}
func (t *QueryIdeasTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"status":   stringEnumProp("Filter by status", "active", "buried", "archived", "implemented"),
			"category": stringProp("Filter by category: tool, service, integration, automation, creative, data, other"),
			"sort":     stringEnumProp("Sort order", "newest", "popular", "most_forked", "most_liked", "most_flowers"),
			"limit":    numberProp("Max results (default 20)"),
			"offset":   numberProp("Pagination offset"),
		},
	})
}
func (t *QueryIdeasTool) Execute(ctx context.Context, _ Principal, in ToolInput) (*ToolResult, error) {
	limit := ToolInt(in, "limit")
	if limit == 0 {
		limit = 20
	}
	ideas, total, err := t.ideaSvc.Query(QueryFilter{
		Status:   ToolStr(in, "status"),
		Category: ToolStr(in, "category"),
		Sort:     ToolStr(in, "sort"),
		Limit:    limit,
		Offset:   ToolInt(in, "offset"),
	})
	if err != nil {
		return nil, fmt.Errorf("query_ideas failed: %w", err)
	}
	return &ToolResult{
		OK:   true,
		Data: map[string]any{"ideas": ideas, "total": total},
		Display: &ToolDisplay{
			Kind: "idea_list",
			Ref:  collectIDs(ideas),
		},
	}, nil
}

// GetIdeaDetailTool 获取单条 idea 的完整详情。
type GetIdeaDetailTool struct {
	ideaSvc *IdeaService
}

func NewGetIdeaDetailTool(ideaSvc *IdeaService) *GetIdeaDetailTool {
	return &GetIdeaDetailTool{ideaSvc: ideaSvc}
}

func (t *GetIdeaDetailTool) Name() string { return "get_idea_detail" }
func (t *GetIdeaDetailTool) Description() string {
	return "Get full details of a specific idea by ID, including description, tags, stats, repo/demo URLs."
}
func (t *GetIdeaDetailTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id": stringProp("ID of the idea"),
		},
		"required": []string{"idea_id"},
	})
}
func (t *GetIdeaDetailTool) Execute(ctx context.Context, _ Principal, in ToolInput) (*ToolResult, error) {
	ideaID, err := ToolStrReq(in, "idea_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	idea, err := t.ideaSvc.GetByID(ideaID)
	if err != nil {
		return &ToolResult{OK: false, Error: fmt.Sprintf("idea %s not found", ideaID)}, nil
	}
	return &ToolResult{
		OK:   true,
		Data: idea,
		Display: &ToolDisplay{
			Kind: "idea_detail",
			Ref:  idea.ID,
		},
	}, nil
}

// =====================================================================
// 写操作类工具（需要 Principal.AgentID 标识作者）
// =====================================================================

// RegisterIdeaTool 注册新 idea。
type RegisterIdeaTool struct {
	ideaSvc *IdeaService
}

func NewRegisterIdeaTool(ideaSvc *IdeaService) *RegisterIdeaTool {
	return &RegisterIdeaTool{ideaSvc: ideaSvc}
}

func (t *RegisterIdeaTool) Name() string { return "register_idea" }
func (t *RegisterIdeaTool) Description() string {
	return "Register (create) a new idea in the marketplace. " +
		"Use when the user wants to publish/share/propose their own idea. " +
		"The system will auto-check for duplicates and may return a warning. " +
		"This is a WRITE operation requiring confirmation: first call without `confirm`, " +
		"then call again with the returned confirmation token once the user agrees."
}
func (t *RegisterIdeaTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		propertiesKey(): map[string]any{
			"title":       stringProp("Concise title for the idea"),
			"description": stringProp("Detailed description: what it does, who it's for, why it matters"),
			"category":    stringEnumProp("Primary category", "tool", "service", "integration", "automation", "creative", "data", "other"),
			"tags":        arrayStringProp("Tags for discoverability"),
			"repo_url":    stringProp("Optional source repository URL"),
			"demo_url":    stringProp("Optional live demo URL"),
		},
		"required": []string{"title", "description", "category"},
	})
}
func (t *RegisterIdeaTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	idea, err := t.ideaSvc.Register(authorID, RegisterIdeaInput{
		Title:       ToolStr(in, "title"),
		Description: ToolStr(in, "description"),
		Category:    ToolStr(in, "category"),
		Tags:        ToolStrSlice(in, "tags"),
		RepoURL:     ToolStr(in, "repo_url"),
		DemoURL:     ToolStr(in, "demo_url"),
	})
	if err != nil {
		return nil, fmt.Errorf("register_idea failed: %w", err)
	}
	data := map[string]any{"idea": idea}
	return &ToolResult{
		OK:   true,
		Data: data,
		Display: &ToolDisplay{
			Kind: "idea_detail",
			Ref:  idea.ID,
		},
	}, nil
}

// ForkIdeaTool 致敬（fork）已有 idea。
type ForkIdeaTool struct {
	socialSvc *SocialService
}

func NewForkIdeaTool(socialSvc *SocialService) *ForkIdeaTool {
	return &ForkIdeaTool{socialSvc: socialSvc}
}

func (t *ForkIdeaTool) Name() string { return "fork_idea" }
func (t *ForkIdeaTool) Description() string {
	return "Fork an existing idea to create a derivative work (致敬). " +
		"Use when user wants to build on / adapt / pay tribute to someone else's idea. " +
		"WRITE operation: requires confirmation (call once without `confirm`, then again with the token)."
}
func (t *ForkIdeaTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id":     stringProp("ID of the source idea to fork"),
			"title":       stringProp("Title for the forked version"),
			"description": stringProp("How this version differs from the original"),
			"reason":      stringProp("Why you are forking (致敬理由)"),
		},
		"required": []string{"idea_id", "title", "description"},
	})
}
func (t *ForkIdeaTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	idea, err := t.socialSvc.ForkIdea(ForkIdeaInput{
		IdeaID:      ToolStr(in, "idea_id"),
		AgentID:     authorID,
		Title:       ToolStr(in, "title"),
		Description: ToolStr(in, "description"),
		Reason:      ToolStr(in, "reason"),
	})
	if err != nil {
		return nil, fmt.Errorf("fork_idea failed: %w", err)
	}
	return &ToolResult{
		OK:   true,
		Data: map[string]any{"idea": idea, "message": "Forked successfully"},
		Display: &ToolDisplay{
			Kind: "idea_detail",
			Ref:  idea.ID,
		},
	}, nil
}

// LikeIdeaTool 点赞。
type LikeIdeaTool struct {
	socialSvc *SocialService
}

func NewLikeIdeaTool(socialSvc *SocialService) *LikeIdeaTool {
	return &LikeIdeaTool{socialSvc: socialSvc}
}

func (t *LikeIdeaTool) Name() string { return "like_idea" }
func (t *LikeIdeaTool) Description() string {
	return "Like / upvote an idea. Use when user expresses approval ('点赞', '支持', 'like')."
}
func (t *LikeIdeaTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id": stringProp("ID of the idea to like"),
		},
		"required": []string{"idea_id"},
	})
}
func (t *LikeIdeaTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	ideaID := ToolStr(in, "idea_id")
	if err := t.socialSvc.LikeIdea(ideaID, p.UserID, authorID); err != nil {
		return nil, fmt.Errorf("like_idea failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"idea_id": ideaID, "liked": true}}, nil
}

// BuryIdeaTool 埋葬（仅作者可调用）。
type BuryIdeaTool struct {
	ideaSvc *IdeaService
}

func NewBuryIdeaTool(ideaSvc *IdeaService) *BuryIdeaTool {
	return &BuryIdeaTool{ideaSvc: ideaSvc}
}

func (t *BuryIdeaTool) Name() string { return "bury_idea" }
func (t *BuryIdeaTool) Description() string {
	return "Mark one of YOUR OWN ideas as buried (no longer pursuing). Only the author can bury. " +
		"WRITE operation: requires confirmation (call once without `confirm`, then again with the token)."
}
func (t *BuryIdeaTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id": stringProp("ID of your idea to bury"),
			"reason":  stringProp("Why you are burying it"),
		},
		"required": []string{"idea_id", "reason"},
	})
}
func (t *BuryIdeaTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	_, err = t.ideaSvc.Bury(ToolStr(in, "idea_id"), authorID, ToolStr(in, "reason"))
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	return &ToolResult{OK: true, Data: map[string]any{"buried": true}}, nil
}

// SendFlowersTool 送花（高规格赞赏）。
type SendFlowersTool struct {
	socialSvc *SocialService
}

func NewSendFlowersTool(socialSvc *SocialService) *SendFlowersTool {
	return &SendFlowersTool{socialSvc: socialSvc}
}

func (t *SendFlowersTool) Name() string { return "send_flowers" }
func (t *SendFlowersTool) Description() string {
	return "Send flowers to an idea as special appreciation (送花, higher praise than like). " +
		"WRITE operation: requires confirmation (call once without `confirm`, then again with the token)."
}
func (t *SendFlowersTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id": stringProp("ID of the idea"),
			"message": stringProp("Optional message accompanying the flowers"),
		},
		"required": []string{"idea_id"},
	})
}
func (t *SendFlowersTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	ideaID := ToolStr(in, "idea_id")
	err = t.socialSvc.SendFlowers(SendFlowersInput{
		IdeaID:  ideaID,
		AgentID: authorID,
		Message: ToolStr(in, "message"),
	})
	if err != nil {
		return nil, fmt.Errorf("send_flowers failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"idea_id": ideaID, "flowers_sent": true}}, nil
}

// CreateCommentTool 评论 idea。
type CreateCommentTool struct {
	wanyeSvc *WanyeService
}

func NewCreateCommentTool(wanyeSvc *WanyeService) *CreateCommentTool {
	return &CreateCommentTool{wanyeSvc: wanyeSvc}
}

func (t *CreateCommentTool) Name() string { return "create_comment" }
func (t *CreateCommentTool) Description() string {
	return "Post a comment on an idea (讨论). Use when user wants to share thoughts, ask questions, or give feedback."
}
func (t *CreateCommentTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id":   stringProp("ID of the idea"),
			"content":   stringProp("Comment content"),
			"sentiment": stringEnumProp("Sentiment tone", "positive", "neutral", "constructive"),
		},
		"required": []string{"idea_id", "content"},
	})
}
func (t *CreateCommentTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	comment, err := t.wanyeSvc.CreateComment(CreateCommentInput{
		IdeaID:    ToolStr(in, "idea_id"),
		UserID:    authorID,
		Content:   ToolStr(in, "content"),
		Sentiment: ToolStr(in, "sentiment"),
	})
	if err != nil {
		return nil, fmt.Errorf("create_comment failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"comment": comment}}, nil
}

// GetCommentsTool 获取 idea 的评论列表。
type GetCommentsTool struct {
	wanyeSvc *WanyeService
}

func NewGetCommentsTool(wanyeSvc *WanyeService) *GetCommentsTool {
	return &GetCommentsTool{wanyeSvc: wanyeSvc}
}

func (t *GetCommentsTool) Name() string { return "get_comments" }
func (t *GetCommentsTool) Description() string {
	return "Get all comments on an idea, including nested replies. Use to show ongoing discussion."
}
func (t *GetCommentsTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id": stringProp("ID of the idea"),
		},
		"required": []string{"idea_id"},
	})
}
func (t *GetCommentsTool) Execute(ctx context.Context, _ Principal, in ToolInput) (*ToolResult, error) {
	ideaID, err := ToolStrReq(in, "idea_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	comments, err := t.wanyeSvc.GetComments(ideaID)
	if err != nil {
		return nil, fmt.Errorf("get_comments failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"comments": comments}}, nil
}

// ---- helpers ----

// requireAuthor 从 Principal 中确定执行写操作的作者 ID。
// 页面用户：尚未有专属 agent → 用 UserID 兜底（仅 IsSystemAssistant 时允许）
// Agent：直接用 AgentID
func requireAuthor(p Principal) (string, error) {
	if p.AgentID != "" {
		return p.AgentID, nil
	}
	if p.IsSystemAssistant && p.UserID != "" {
		// 万叶助手代用户操作时，把 UserID 作为 agent_id 占位。
		// 更严谨的实现应该为每个用户自动创建 shadow agent，这里先支持基础场景。
		return "user:" + p.UserID, nil
	}
	return "", fmt.Errorf("this action requires authentication (no agent or user identity)")
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

func summarizeIDs(matches []IdeaMatch) string {
	ids := make([]string, 0, len(matches))
	for _, m := range matches {
		ids = append(ids, m.Idea.ID)
	}
	b, _ := json.Marshal(ids)
	return string(b)
}

func collectIDs(ideas []model.Idea) string {
	ids := make([]string, 0, len(ideas))
	for _, i := range ideas {
		ids = append(ids, i.ID)
	}
	b, _ := json.Marshal(ids)
	return string(b)
}

// propertiesKey 用于在 Parameters() 中避免魔法字符串。
func propertiesKey() string { return "properties" }
