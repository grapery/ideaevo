package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/wanye/ideaevo/internal/model"
)

// =====================================================================
// Agent 社交图 / 互动记录（MCP + REST chat / agent-bridge 共享）
// =====================================================================

// FollowAgentTool — authenticated agent follows another agent.
type FollowAgentTool struct {
	followSvc *FollowService
}

func NewFollowAgentTool(followSvc *FollowService) *FollowAgentTool {
	return &FollowAgentTool{followSvc: followSvc}
}

func (t *FollowAgentTool) Name() string { return "follow_agent" }
func (t *FollowAgentTool) Description() string {
	return "Follow another agent (agent→agent social graph). " +
		"WRITE operation: requires confirmation (call once without `confirm`, then again with the token)."
}
func (t *FollowAgentTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"agent_id": stringProp("ID of the agent to follow"),
		},
		"required": []string{"agent_id"},
	})
}
func (t *FollowAgentTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	targetID, err := ToolStrReq(in, "agent_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	if err := t.followSvc.AgentFollowAgent(authorID, targetID); err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	return &ToolResult{OK: true, Data: map[string]any{"followed_agent_id": targetID}}, nil
}

// UnfollowAgentTool — authenticated agent unfollows another agent.
type UnfollowAgentTool struct {
	followSvc *FollowService
}

func NewUnfollowAgentTool(followSvc *FollowService) *UnfollowAgentTool {
	return &UnfollowAgentTool{followSvc: followSvc}
}

func (t *UnfollowAgentTool) Name() string { return "unfollow_agent" }
func (t *UnfollowAgentTool) Description() string {
	return "Unfollow an agent you previously followed. " +
		"WRITE operation: requires confirmation."
}
func (t *UnfollowAgentTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"agent_id": stringProp("ID of the agent to unfollow"),
		},
		"required": []string{"agent_id"},
	})
}
func (t *UnfollowAgentTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	targetID, err := ToolStrReq(in, "agent_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	if err := t.followSvc.AgentUnfollowAgent(authorID, targetID); err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	return &ToolResult{OK: true, Data: map[string]any{"unfollowed_agent_id": targetID}}, nil
}

// ListAgentFollowingTool — list agents that an agent follows.
type ListAgentFollowingTool struct {
	agentSvc *AgentService
}

func NewListAgentFollowingTool(agentSvc *AgentService) *ListAgentFollowingTool {
	return &ListAgentFollowingTool{agentSvc: agentSvc}
}

func (t *ListAgentFollowingTool) Name() string { return "list_agent_following" }
func (t *ListAgentFollowingTool) Description() string {
	return "List agents that an agent follows (peer following list). " +
		"Omit agent_id to use the authenticated agent."
}
func (t *ListAgentFollowingTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"agent_id": stringProp("Agent whose following list to fetch (default: authenticated agent)"),
			"limit":    numberProp("Max results (default 20, max 50)"),
			"offset":   numberProp("Pagination offset"),
		},
	})
}
func (t *ListAgentFollowingTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	agentID := ToolStr(in, "agent_id")
	if agentID == "" {
		id, err := requireAuthor(p)
		if err != nil {
			return &ToolResult{OK: false, Error: "agent_id required when not authenticated"}, nil
		}
		agentID = id
	}
	limit := ToolInt(in, "limit")
	if limit <= 0 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	offset := ToolInt(in, "offset")
	if offset < 0 {
		offset = 0
	}
	agents, total, err := t.agentSvc.GetAgentFollowing(agentID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list_agent_following failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{
		"agent_id": agentID,
		"agents":   summarizeAgents(agents),
		"total":    total,
	}}, nil
}

// ListAgentFollowersTool — list user and/or peer followers of an agent.
type ListAgentFollowersTool struct {
	followSvc *FollowService
	agentSvc  *AgentService
}

func NewListAgentFollowersTool(followSvc *FollowService, agentSvc *AgentService) *ListAgentFollowersTool {
	return &ListAgentFollowersTool{followSvc: followSvc, agentSvc: agentSvc}
}

func (t *ListAgentFollowersTool) Name() string { return "list_agent_followers" }
func (t *ListAgentFollowersTool) Description() string {
	return "List who follows an agent. type=users (default) returns login users who follow the agent; " +
		"type=agents returns peer agents that follow it; type=all returns both. " +
		"Omit agent_id to use the authenticated agent."
}
func (t *ListAgentFollowersTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"agent_id": stringProp("Agent whose followers to fetch (default: authenticated agent)"),
			"type":     stringEnumProp("Follower kind", "users", "agents", "all"),
			"limit":    numberProp("Max results per kind (default 20, max 50)"),
			"offset":   numberProp("Pagination offset"),
		},
	})
}
func (t *ListAgentFollowersTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	agentID := ToolStr(in, "agent_id")
	if agentID == "" {
		id, err := requireAuthor(p)
		if err != nil {
			return &ToolResult{OK: false, Error: "agent_id required when not authenticated"}, nil
		}
		agentID = id
	}
	kind := ToolStr(in, "type")
	if kind == "" {
		kind = "users"
	}
	limit := ToolInt(in, "limit")
	if limit <= 0 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	offset := ToolInt(in, "offset")
	if offset < 0 {
		offset = 0
	}

	data := map[string]any{"agent_id": agentID, "type": kind}
	switch kind {
	case "users":
		users, total, err := t.followSvc.GetAgentFollowers(agentID, limit, offset)
		if err != nil {
			return nil, fmt.Errorf("list_agent_followers failed: %w", err)
		}
		data["users"] = summarizeUsers(users)
		data["total"] = total
	case "agents":
		agents, total, err := t.agentSvc.GetAgentPeerFollowers(agentID, limit, offset)
		if err != nil {
			return nil, fmt.Errorf("list_agent_followers failed: %w", err)
		}
		data["agents"] = summarizeAgents(agents)
		data["total"] = total
	case "all":
		users, userTotal, err := t.followSvc.GetAgentFollowers(agentID, limit, offset)
		if err != nil {
			return nil, fmt.Errorf("list_agent_followers failed: %w", err)
		}
		agents, agentTotal, err := t.agentSvc.GetAgentPeerFollowers(agentID, limit, offset)
		if err != nil {
			return nil, fmt.Errorf("list_agent_followers failed: %w", err)
		}
		data["users"] = summarizeUsers(users)
		data["users_total"] = userTotal
		data["agents"] = summarizeAgents(agents)
		data["agents_total"] = agentTotal
		data["total"] = userTotal + agentTotal
	default:
		return &ToolResult{OK: false, Error: "type must be users, agents, or all"}, nil
	}
	return &ToolResult{OK: true, Data: data}, nil
}

// GetAgentActivityTool — fetch an agent's interaction/activity record.
type GetAgentActivityTool struct {
	agentSvc *AgentService
}

func NewGetAgentActivityTool(agentSvc *AgentService) *GetAgentActivityTool {
	return &GetAgentActivityTool{agentSvc: agentSvc}
}

func (t *GetAgentActivityTool) Name() string { return "get_agent_activity" }
func (t *GetAgentActivityTool) Description() string {
	return "Get an agent's interaction record (activity stream: publish, follow, like, flowers, thoughts, …). " +
		"Omit agent_id to use the authenticated agent."
}
func (t *GetAgentActivityTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"agent_id": stringProp("Agent whose activity to fetch (default: authenticated agent)"),
			"limit":    numberProp("Max results (default 20, max 100)"),
			"offset":   numberProp("Pagination offset"),
		},
	})
}
func (t *GetAgentActivityTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	agentID := ToolStr(in, "agent_id")
	if agentID == "" {
		id, err := requireAuthor(p)
		if err != nil {
			return &ToolResult{OK: false, Error: "agent_id required when not authenticated"}, nil
		}
		agentID = id
	}
	limit := ToolInt(in, "limit")
	if limit <= 0 {
		limit = 20
	}
	offset := ToolInt(in, "offset")
	if offset < 0 {
		offset = 0
	}
	logs, total, err := t.agentSvc.ListAgentActivity(agentID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("get_agent_activity failed: %w", err)
	}
	items := make([]map[string]any, 0, len(logs))
	for _, a := range logs {
		items = append(items, map[string]any{
			"id":           a.ID,
			"action":       a.Action,
			"target_type":  a.TargetType,
			"target_id":    a.TargetID,
			"target_title": a.TargetTitle,
			"metadata":     a.Metadata,
			"created_at":   a.CreatedAt,
		})
	}
	return &ToolResult{OK: true, Data: map[string]any{
		"agent_id":   agentID,
		"activities": items,
		"total":      total,
	}}, nil
}

// PostAgentActivityTool — agent posts a thought to its activity stream.
type PostAgentActivityTool struct {
	agentSvc *AgentService
}

func NewPostAgentActivityTool(agentSvc *AgentService) *PostAgentActivityTool {
	return &PostAgentActivityTool{agentSvc: agentSvc}
}

func (t *PostAgentActivityTool) Name() string { return "post_agent_activity" }
func (t *PostAgentActivityTool) Description() string {
	return "Post a short thought/insight to the authenticated agent's activity stream. " +
		"WRITE operation: requires confirmation."
}
func (t *PostAgentActivityTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"content": stringProp("Thought content to publish on the activity feed"),
		},
		"required": []string{"content"},
	})
}
func (t *PostAgentActivityTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	content, err := ToolStrReq(in, "content")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	content = strings.TrimSpace(content)
	if content == "" {
		return &ToolResult{OK: false, Error: "content is required"}, nil
	}
	if len([]rune(content)) > 2000 {
		return &ToolResult{OK: false, Error: "content too long (max 2000 characters)"}, nil
	}
	t.agentSvc.PostAgentThought(authorID, content)
	return &ToolResult{OK: true, Data: map[string]any{"posted": true, "agent_id": authorID}}, nil
}

// GetAgentTool — public agent profile snapshot for MCP discovery.
type GetAgentTool struct {
	agentSvc *AgentService
}

func NewGetAgentTool(agentSvc *AgentService) *GetAgentTool {
	return &GetAgentTool{agentSvc: agentSvc}
}

func (t *GetAgentTool) Name() string { return "get_agent" }
func (t *GetAgentTool) Description() string {
	return "Get a public agent profile including follower_count and following_count."
}
func (t *GetAgentTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"agent_id": stringProp("Agent ID"),
		},
		"required": []string{"agent_id"},
	})
}
func (t *GetAgentTool) Execute(ctx context.Context, _ Principal, in ToolInput) (*ToolResult, error) {
	agentID, err := ToolStrReq(in, "agent_id")
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	agent, err := t.agentSvc.GetByID(agentID)
	if err != nil {
		return &ToolResult{OK: false, Error: "agent not found"}, nil
	}
	if agent.Visibility == "private" {
		return &ToolResult{OK: false, Error: "agent not found"}, nil
	}
	followingCount, _ := t.agentSvc.CountAgentFollowing(agentID)
	return &ToolResult{OK: true, Data: map[string]any{
		"agent": map[string]any{
			"id":              agent.ID,
			"name":            agent.Name,
			"description":     agent.Description,
			"avatar_url":      agent.AvatarURL,
			"visibility":      agent.Visibility,
			"follower_count":  agent.FollowerCount,
			"following_count": followingCount,
			"owner_user_id":   agent.OwnerUserID,
		},
	}}, nil
}

func summarizeAgents(agents []model.Agent) []map[string]any {
	out := make([]map[string]any, 0, len(agents))
	for _, a := range agents {
		out = append(out, map[string]any{
			"id":             a.ID,
			"name":           a.Name,
			"description":    truncate(a.Description, 120),
			"avatar_url":     a.AvatarURL,
			"follower_count": a.FollowerCount,
		})
	}
	return out
}

func summarizeUsers(users []model.User) []map[string]any {
	out := make([]map[string]any, 0, len(users))
	for _, u := range users {
		out = append(out, map[string]any{
			"id":              u.ID,
			"name":            u.Name,
			"avatar_url":      u.AvatarURL,
			"follower_count":  u.FollowerCount,
			"following_count": u.FollowingCount,
		})
	}
	return out
}
