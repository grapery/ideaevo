package service

// tools_extra.go —— MCP 工具补全：把 REST 已有、MCP 缺失的能力补进工具注册表。
// 读类：想法统计/版本历史/热榜/Agent 的想法列表/送花名单。
// 写类：采纳与删除建议、关注用户、收藏想法、表情回应、发布新版本。

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/wanye/ideaevo/internal/model"
)

// resolvePrincipalUser 解析主体对应的用户 ID：登录用户优先，否则取 Agent 的 owner。
// 用于用户维度的操作（关注用户 / 收藏想法）。
func resolvePrincipalUser(p Principal, agentSvc *AgentService) string {
	if p.UserID != "" {
		return p.UserID
	}
	if p.AgentID == "" {
		return ""
	}
	if agent, err := agentSvc.GetByID(p.AgentID); err == nil {
		return agent.OwnerUserID
	}
	return ""
}

// ---- 读类工具 ----

// GetIdeaStatsTool 想法互动统计。
type GetIdeaStatsTool struct {
	ideaSvc *IdeaService
}

func NewGetIdeaStatsTool(ideaSvc *IdeaService) *GetIdeaStatsTool {
	return &GetIdeaStatsTool{ideaSvc: ideaSvc}
}

func (t *GetIdeaStatsTool) Name() string { return "get_idea_stats" }
func (t *GetIdeaStatsTool) Description() string {
	return "Get engagement counters for an idea: likes, wishes, flowers, forks, comments, views, versions."
}
func (t *GetIdeaStatsTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type":       "object",
		"properties": map[string]any{"idea_id": stringProp("ID of the idea")},
		"required":   []string{"idea_id"},
	})
}
func (t *GetIdeaStatsTool) Execute(ctx context.Context, _ Principal, in ToolInput) (*ToolResult, error) {
	ideaID, err := ToolStrReq(in, "idea_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	stats, err := t.ideaSvc.Stats(ideaID)
	if err != nil {
		return nil, fmt.Errorf("get_idea_stats failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"stats": stats}}, nil
}

// GetIdeaVersionsTool 想法版本历史。
type GetIdeaVersionsTool struct {
	ideaSvc *IdeaService
}

func NewGetIdeaVersionsTool(ideaSvc *IdeaService) *GetIdeaVersionsTool {
	return &GetIdeaVersionsTool{ideaSvc: ideaSvc}
}

func (t *GetIdeaVersionsTool) Name() string { return "get_idea_versions" }
func (t *GetIdeaVersionsTool) Description() string {
	return "Get the version history of an idea (changelog per version). Useful to see how an idea evolved."
}
func (t *GetIdeaVersionsTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type":       "object",
		"properties": map[string]any{"idea_id": stringProp("ID of the idea")},
		"required":   []string{"idea_id"},
	})
}
func (t *GetIdeaVersionsTool) Execute(ctx context.Context, _ Principal, in ToolInput) (*ToolResult, error) {
	ideaID, err := ToolStrReq(in, "idea_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	versions, err := t.ideaSvc.ListVersions(ideaID)
	if err != nil {
		return nil, fmt.Errorf("get_idea_versions failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"versions": versions}}, nil
}

// GetRankingTool 时间窗热榜。
type GetRankingTool struct {
	ideaSvc *IdeaService
}

func NewGetRankingTool(ideaSvc *IdeaService) *GetRankingTool {
	return &GetRankingTool{ideaSvc: ideaSvc}
}

func (t *GetRankingTool) Name() string { return "get_ranking" }
func (t *GetRankingTool) Description() string {
	return "Get the trending leaderboard over a time window (weighted score is abuse-resistant). Use to find what the community values most right now."
}
func (t *GetRankingTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"window": stringEnumProp("Time window (default week)", "day", "week", "month"),
			"metric": stringEnumProp("Ranking metric (default weighted)", "weighted", "wish", "like", "flower", "fork", "comment"),
			"limit":  numberProp("Max results (default 10)"),
		},
	})
}
func (t *GetRankingTool) Execute(ctx context.Context, _ Principal, in ToolInput) (*ToolResult, error) {
	window := ToolStr(in, "window")
	if window == "" {
		window = "week"
	}
	metric := ToolStr(in, "metric")
	if metric == "" {
		metric = "weighted"
	}
	limit := ToolInt(in, "limit")
	if limit == 0 {
		limit = 10
	}
	ranking, err := t.ideaSvc.RankingTrending(window, metric, limit)
	if err != nil {
		return nil, fmt.Errorf("get_ranking failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"ranking": ranking, "window": window, "metric": metric}}, nil
}

// ListAgentIdeasTool 某 Agent 发布的想法列表。
type ListAgentIdeasTool struct {
	ideaSvc *IdeaService
}

func NewListAgentIdeasTool(ideaSvc *IdeaService) *ListAgentIdeasTool {
	return &ListAgentIdeasTool{ideaSvc: ideaSvc}
}

func (t *ListAgentIdeasTool) Name() string { return "list_agent_ideas" }
func (t *ListAgentIdeasTool) Description() string {
	return "List ideas published by a specific agent. Useful to review an agent's portfolio before delegating work."
}
func (t *ListAgentIdeasTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"agent_id": stringProp("ID of the agent"),
			"limit":    numberProp("Max results (default 20)"),
			"offset":   numberProp("Pagination offset"),
		},
		"required": []string{"agent_id"},
	})
}
func (t *ListAgentIdeasTool) Execute(ctx context.Context, _ Principal, in ToolInput) (*ToolResult, error) {
	agentID, err := ToolStrReq(in, "agent_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	limit := ToolInt(in, "limit")
	if limit == 0 {
		limit = 20
	}
	ideas, total, err := t.ideaSvc.Query(QueryFilter{AgentID: agentID, Sort: "newest", Limit: limit, Offset: ToolInt(in, "offset")})
	if err != nil {
		return nil, fmt.Errorf("list_agent_ideas failed: %w", err)
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

// GetFlowerSendersTool 送花名单。
type GetFlowerSendersTool struct {
	socialSvc *SocialService
}

func NewGetFlowerSendersTool(socialSvc *SocialService) *GetFlowerSendersTool {
	return &GetFlowerSendersTool{socialSvc: socialSvc}
}

func (t *GetFlowerSendersTool) Name() string { return "get_flower_senders" }
func (t *GetFlowerSendersTool) Description() string {
	return "List who sent flowers (premium appreciation) to an idea, with their latest message if any."
}
func (t *GetFlowerSendersTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id": stringProp("ID of the idea"),
			"limit":   numberProp("Max results (default 20)"),
		},
		"required": []string{"idea_id"},
	})
}
func (t *GetFlowerSendersTool) Execute(ctx context.Context, _ Principal, in ToolInput) (*ToolResult, error) {
	ideaID, err := ToolStrReq(in, "idea_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	limit := ToolInt(in, "limit")
	if limit == 0 {
		limit = 20
	}
	donors, err := t.socialSvc.GetFlowerDonors(ideaID, limit)
	if err != nil {
		return nil, fmt.Errorf("get_flower_senders failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"senders": donors}}, nil
}

// ---- 写类工具 ----

// SelectSuggestionTool owner 采纳建议（创建实现任务）。
type SelectSuggestionTool struct {
	suggestionSvc *SuggestionService
}

func NewSelectSuggestionTool(svc *SuggestionService) *SelectSuggestionTool {
	return &SelectSuggestionTool{svc}
}

func (t *SelectSuggestionTool) Name() string { return "select_suggestion" }
func (t *SelectSuggestionTool) Description() string {
	return "Accept a suggestion on an idea you own. Creates an implementation job and notifies the submitter. " +
		"WRITE operation: requires confirmation (call once without `confirm`, then again with the token)."
}
func (t *SelectSuggestionTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id":       stringProp("ID of the idea (must be owned by you)"),
			"suggestion_id": stringProp("ID of the suggestion to accept"),
		},
		"required": []string{"idea_id", "suggestion_id"},
	})
}
func (t *SelectSuggestionTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	ideaID, err := ToolStrReq(in, "idea_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	sugID, err := ToolStrReq(in, "suggestion_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	result, err := t.suggestionSvc.Select(ideaID, sugID, p.UserID, authorID)
	if err != nil {
		return nil, fmt.Errorf("select_suggestion failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{
		"suggestion": result.Suggestion, "job_id": result.JobID,
	}}, nil
}

// DeleteSuggestionTool 建议作者删除自己的建议。
type DeleteSuggestionTool struct {
	suggestionSvc *SuggestionService
}

func NewDeleteSuggestionTool(svc *SuggestionService) *DeleteSuggestionTool {
	return &DeleteSuggestionTool{svc}
}

func (t *DeleteSuggestionTool) Name() string { return "delete_suggestion" }
func (t *DeleteSuggestionTool) Description() string {
	return "Delete a suggestion you submitted. Accepted suggestions cannot be deleted. " +
		"WRITE operation: requires confirmation."
}
func (t *DeleteSuggestionTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id":       stringProp("ID of the idea the suggestion belongs to"),
			"suggestion_id": stringProp("ID of the suggestion"),
		},
		"required": []string{"idea_id", "suggestion_id"},
	})
}
func (t *DeleteSuggestionTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	ideaID, err := ToolStrReq(in, "idea_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	sugID, err := ToolStrReq(in, "suggestion_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	if err := t.suggestionSvc.Delete(ideaID, sugID, p.UserID, authorID); err != nil {
		return nil, fmt.Errorf("delete_suggestion failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"deleted": true, "suggestion_id": sugID}}, nil
}

// FollowUserTool 关注用户。
type FollowUserTool struct {
	followSvc *FollowService
	agentSvc  *AgentService
}

func NewFollowUserTool(followSvc *FollowService, agentSvc *AgentService) *FollowUserTool {
	return &FollowUserTool{followSvc: followSvc, agentSvc: agentSvc}
}

func (t *FollowUserTool) Name() string { return "follow_user" }
func (t *FollowUserTool) Description() string {
	return "Follow a user (on behalf of the authenticated agent's owner). Their activity shows up in your following feed. " +
		"WRITE operation: requires confirmation."
}
func (t *FollowUserTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type":       "object",
		"properties": map[string]any{"user_id": stringProp("ID of the user to follow")},
		"required":   []string{"user_id"},
	})
}
func (t *FollowUserTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	if _, err := requireAuthor(p); err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	userID, err := ToolStrReq(in, "user_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	follower := resolvePrincipalUser(p, t.agentSvc)
	if follower == "" {
		return &ToolResult{OK: false, Error: "cannot resolve the acting user for follow_user"}, nil
	}
	if err := t.followSvc.Follow(follower, userID); err != nil {
		return nil, fmt.Errorf("follow_user failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"following": true, "user_id": userID}}, nil
}

// UnfollowUserTool 取消关注用户。
type UnfollowUserTool struct {
	followSvc *FollowService
	agentSvc  *AgentService
}

func NewUnfollowUserTool(followSvc *FollowService, agentSvc *AgentService) *UnfollowUserTool {
	return &UnfollowUserTool{followSvc: followSvc, agentSvc: agentSvc}
}

func (t *UnfollowUserTool) Name() string { return "unfollow_user" }
func (t *UnfollowUserTool) Description() string {
	return "Unfollow a user. WRITE operation."
}
func (t *UnfollowUserTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type":       "object",
		"properties": map[string]any{"user_id": stringProp("ID of the user to unfollow")},
		"required":   []string{"user_id"},
	})
}
func (t *UnfollowUserTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	if _, err := requireAuthor(p); err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	userID, err := ToolStrReq(in, "user_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	follower := resolvePrincipalUser(p, t.agentSvc)
	if follower == "" {
		return &ToolResult{OK: false, Error: "cannot resolve the acting user for unfollow_user"}, nil
	}
	if err := t.followSvc.Unfollow(follower, userID); err != nil {
		return nil, fmt.Errorf("unfollow_user failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"following": false, "user_id": userID}}, nil
}

// BookmarkIdeaTool 收藏想法。
type BookmarkIdeaTool struct {
	ideaSvc  *IdeaService
	agentSvc *AgentService
}

func NewBookmarkIdeaTool(ideaSvc *IdeaService, agentSvc *AgentService) *BookmarkIdeaTool {
	return &BookmarkIdeaTool{ideaSvc: ideaSvc, agentSvc: agentSvc}
}

func (t *BookmarkIdeaTool) Name() string { return "bookmark_idea" }
func (t *BookmarkIdeaTool) Description() string {
	return "Bookmark an idea for later reference (on behalf of the agent's owner). WRITE operation: requires confirmation."
}
func (t *BookmarkIdeaTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type":       "object",
		"properties": map[string]any{"idea_id": stringProp("ID of the idea to bookmark")},
		"required":   []string{"idea_id"},
	})
}
func (t *BookmarkIdeaTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	if _, err := requireAuthor(p); err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	ideaID, err := ToolStrReq(in, "idea_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	user := resolvePrincipalUser(p, t.agentSvc)
	if user == "" {
		return &ToolResult{OK: false, Error: "cannot resolve the acting user for bookmark_idea"}, nil
	}
	if err := t.ideaSvc.Bookmark(ideaID, user); err != nil {
		return nil, fmt.Errorf("bookmark_idea failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"bookmarked": true, "idea_id": ideaID}}, nil
}

// UnbookmarkIdeaTool 取消收藏。
type UnbookmarkIdeaTool struct {
	ideaSvc  *IdeaService
	agentSvc *AgentService
}

func NewUnbookmarkIdeaTool(ideaSvc *IdeaService, agentSvc *AgentService) *UnbookmarkIdeaTool {
	return &UnbookmarkIdeaTool{ideaSvc: ideaSvc, agentSvc: agentSvc}
}

func (t *UnbookmarkIdeaTool) Name() string { return "unbookmark_idea" }
func (t *UnbookmarkIdeaTool) Description() string {
	return "Remove a bookmark from an idea. WRITE operation."
}
func (t *UnbookmarkIdeaTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type":       "object",
		"properties": map[string]any{"idea_id": stringProp("ID of the idea")},
		"required":   []string{"idea_id"},
	})
}
func (t *UnbookmarkIdeaTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	if _, err := requireAuthor(p); err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	ideaID, err := ToolStrReq(in, "idea_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	user := resolvePrincipalUser(p, t.agentSvc)
	if user == "" {
		return &ToolResult{OK: false, Error: "cannot resolve the acting user for unbookmark_idea"}, nil
	}
	if err := t.ideaSvc.Unbookmark(ideaID, user); err != nil {
		return nil, fmt.Errorf("unbookmark_idea failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"bookmarked": false, "idea_id": ideaID}}, nil
}

// ReactIdeaTool 表情回应。
type ReactIdeaTool struct {
	socialSvc *SocialService
}

func NewReactIdeaTool(socialSvc *SocialService) *ReactIdeaTool {
	return &ReactIdeaTool{socialSvc: socialSvc}
}

func (t *ReactIdeaTool) Name() string { return "react_idea" }
func (t *ReactIdeaTool) Description() string {
	return "React to an idea with an emoji (e.g. 👍 🔥 ❤️). Reactions are lightweight social signals. " +
		"WRITE operation: requires confirmation."
}
func (t *ReactIdeaTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id": stringProp("ID of the idea"),
			"emoji":   stringProp("The emoji to react with"),
		},
		"required": []string{"idea_id", "emoji"},
	})
}
func (t *ReactIdeaTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	ideaID, err := ToolStrReq(in, "idea_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	emoji, err := ToolStrReq(in, "emoji")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	if err := t.socialSvc.ReactToIdea(ideaID, p.UserID, authorID, emoji); err != nil {
		return nil, fmt.Errorf("react_idea failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"idea_id": ideaID, "emoji": emoji}}, nil
}

// PublishIdeaVersionTool 发布新版本（owner）。
type PublishIdeaVersionTool struct {
	ideaSvc *IdeaService
}

func NewPublishIdeaVersionTool(ideaSvc *IdeaService) *PublishIdeaVersionTool {
	return &PublishIdeaVersionTool{ideaSvc: ideaSvc}
}

func (t *PublishIdeaVersionTool) Name() string { return "publish_idea_version" }
func (t *PublishIdeaVersionTool) Description() string {
	return "Publish a new version of an idea you own (requires title, description, category, changelog). " +
		"Use after implementing an accepted suggestion to record what changed. " +
		"WRITE operation: requires confirmation."
}
func (t *PublishIdeaVersionTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id":     stringProp("ID of the idea (must be owned by the acting agent)"),
			"title":       stringProp("New version title"),
			"description": stringProp("New version description (markdown)"),
			"category":    stringProp("Category: tool, service, integration, automation, creative, data, other"),
			"changelog":   stringProp("What changed in this version (required)"),
			"impl_status": stringEnumProp("Implementation status", "concept", "in_progress", "implemented", "paused"),
			"repo_url":    stringProp("Optional repository URL"),
			"demo_url":    stringProp("Optional demo URL"),
			"tags":        map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
		},
		"required": []string{"idea_id", "title", "description", "category", "changelog"},
	})
}
func (t *PublishIdeaVersionTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	ideaID, err := ToolStrReq(in, "idea_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	// 与 REST 一致的权限：只有想法所属 Agent（或其 owner 的其他 Agent 不行）可发版本
	idea, err := t.ideaSvc.GetByID(ideaID)
	if err != nil {
		return nil, fmt.Errorf("publish_idea_version failed: idea not found")
	}
	if idea.AgentID != authorID {
		return &ToolResult{OK: false, Error: "only the agent that owns this idea can publish versions"}, nil
	}
	input := PublishIdeaVersionInput{
		Title:       ToolStr(in, "title"),
		Description: ToolStr(in, "description"),
		Category:    ToolStr(in, "category"),
		Changelog:   ToolStr(in, "changelog"),
		ImplStatus:  ToolStr(in, "impl_status"),
		RepoURL:     ToolStr(in, "repo_url"),
		DemoURL:     ToolStr(in, "demo_url"),
		Tags:        ToolStrSlice(in, "tags"),
	}
	updated, err := t.ideaSvc.PublishVersion(ideaID, input, nil)
	if err != nil {
		return nil, fmt.Errorf("publish_idea_version failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"idea": updated}}, nil
}

var _ = model.Idea{} // 保持 model import（idea 比对用到字段）
