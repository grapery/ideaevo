package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// 本文件补齐 MCP 工具与 REST 能力的对齐缺口（2026-08 审计）：
//   生命周期回退 reactivate / 撤销 unwish+unreact / 谱系只读 lineage /
//   评论改删 / 轻量描述更新 / 全局动态流。
// 全部复用既有 service 方法，与 REST 同一份数据路径。

// ---- ReactivateIdeaTool：archived/buried → active（生命周期闭环） ----

type ReactivateIdeaTool struct {
	ideaSvc *IdeaService
}

func NewReactivateIdeaTool(ideaSvc *IdeaService) *ReactivateIdeaTool {
	return &ReactivateIdeaTool{ideaSvc: ideaSvc}
}

func (t *ReactivateIdeaTool) Name() string { return "reactivate_idea" }

func (t *ReactivateIdeaTool) Description() string {
	return "Reactivate one of YOUR OWN ideas (archived/buried → active), e.g. after new evidence revives it. " +
		"Counterpart of bury_idea/archive_idea. Only the author can reactivate. " +
		"WRITE operation: requires confirmation (call once without `confirm`, then again with the token)."
}

func (t *ReactivateIdeaTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id": stringProp("ID of your idea to reactivate"),
			"reason":  stringProp("Why you are reviving it (shown to the caller for context)"),
		},
		"required": []string{"idea_id"},
	})
}

func (t *ReactivateIdeaTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	idea, err := t.ideaSvc.Reactivate(ToolStr(in, "idea_id"), authorID)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	return &ToolResult{OK: true, Data: map[string]any{
		"idea_id": idea.ID, "status": idea.Status,
		"message": "idea reactivated to active",
	}}, nil
}

// ---- UnwishIdeaTool：撤销期待 ----

type UnwishIdeaTool struct {
	socialSvc *SocialService
}

func NewUnwishIdeaTool(socialSvc *SocialService) *UnwishIdeaTool {
	return &UnwishIdeaTool{socialSvc: socialSvc}
}

func (t *UnwishIdeaTool) Name() string { return "unwish_idea" }

func (t *UnwishIdeaTool) Description() string {
	return "Remove your wish (期待) signal from an idea. Counterpart of wish_idea."
}

func (t *UnwishIdeaTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id": stringProp("ID of the idea"),
		},
		"required": []string{"idea_id"},
	})
}

func (t *UnwishIdeaTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	if err := t.socialSvc.UnwishIdea(ToolStr(in, "idea_id"), p.UserID, authorID); err != nil {
		return nil, fmt.Errorf("unwish_idea failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"message": "wish removed"}}, nil
}

// ---- UnreactIdeaTool：撤销 emoji 反应 ----

type UnreactIdeaTool struct {
	socialSvc *SocialService
}

func NewUnreactIdeaTool(socialSvc *SocialService) *UnreactIdeaTool {
	return &UnreactIdeaTool{socialSvc: socialSvc}
}

func (t *UnreactIdeaTool) Name() string { return "unreact_idea" }

func (t *UnreactIdeaTool) Description() string {
	return "Remove one of your emoji reactions from an idea. Counterpart of react_idea."
}

func (t *UnreactIdeaTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id": stringProp("ID of the idea"),
			"emoji":   stringProp("The emoji you previously reacted with"),
		},
		"required": []string{"idea_id", "emoji"},
	})
}

func (t *UnreactIdeaTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	if err := t.socialSvc.UnreactIdea(ToolStr(in, "idea_id"), p.UserID, authorID, ToolStr(in, "emoji")); err != nil {
		return nil, fmt.Errorf("unreact_idea failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{"message": "reaction removed"}}, nil
}

// ---- UpdateCommentTool / DeleteCommentTool：作者改删自己的评论 ----

type UpdateCommentTool struct {
	commentSvc *CommentService
}

func NewUpdateCommentTool(commentSvc *CommentService) *UpdateCommentTool {
	return &UpdateCommentTool{commentSvc: commentSvc}
}

func (t *UpdateCommentTool) Name() string { return "update_comment" }

func (t *UpdateCommentTool) Description() string {
	return "Edit the content of a comment YOU wrote. Counterpart of create_comment."
}

func (t *UpdateCommentTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"comment_id": stringProp("ID of your comment"),
			"content":    stringProp("New content (markdown supported)"),
		},
		"required": []string{"comment_id", "content"},
	})
}

func (t *UpdateCommentTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	comment, err := t.commentSvc.UpdateComment(ToolStr(in, "comment_id"), authorID, ToolStr(in, "content"))
	if err != nil {
		return &ToolResult{OK: false, Error: "comment not found or not yours"}, nil
	}
	return &ToolResult{OK: true, Data: map[string]any{"comment": comment}}, nil
}

type DeleteCommentTool struct {
	commentSvc *CommentService
}

func NewDeleteCommentTool(commentSvc *CommentService) *DeleteCommentTool {
	return &DeleteCommentTool{commentSvc: commentSvc}
}

func (t *DeleteCommentTool) Name() string { return "delete_comment" }

func (t *DeleteCommentTool) Description() string {
	return "Delete a comment YOU wrote. Irreversible."
}

func (t *DeleteCommentTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"comment_id": stringProp("ID of your comment"),
		},
		"required": []string{"comment_id"},
	})
}

func (t *DeleteCommentTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	if err := t.commentSvc.DeleteComment(ToolStr(in, "comment_id"), authorID); err != nil {
		return &ToolResult{OK: false, Error: "comment not found or not yours"}, nil
	}
	return &ToolResult{OK: true, Data: map[string]any{"message": "comment deleted"}}, nil
}

// ---- UpdateIdeaDescriptionTool：轻量描述更新（免整版快照） ----

type UpdateIdeaDescriptionTool struct {
	ideaSvc *IdeaService
	assets  *ObjectStore
}

func NewUpdateIdeaDescriptionTool(ideaSvc *IdeaService, assets *ObjectStore) *UpdateIdeaDescriptionTool {
	return &UpdateIdeaDescriptionTool{ideaSvc: ideaSvc, assets: assets}
}

func (t *UpdateIdeaDescriptionTool) Name() string { return "update_idea_description" }

func (t *UpdateIdeaDescriptionTool) Description() string {
	return "Update the markdown description of an idea YOU own, recording a changelog entry. " +
		"Lighter than publish_idea_version (no title/category snapshot required); " +
		"use this for wording edits, use publish_idea_version for structural releases."
}

func (t *UpdateIdeaDescriptionTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id":     stringProp("ID of your idea"),
			"description": stringProp("New markdown description"),
			"changelog":   stringProp("Short note about what changed"),
		},
		"required": []string{"idea_id", "description"},
	})
}

func (t *UpdateIdeaDescriptionTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	authorID, err := requireAuthor(p)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	input := UpdateDescriptionInput{
		Description: ToolStr(in, "description"),
		Changelog:   ToolStr(in, "changelog"),
	}
	idea, err := t.ideaSvc.UpdateDescription(ToolStr(in, "idea_id"), input, t.assets)
	if err != nil {
		return &ToolResult{OK: false, Error: err.Error()}, nil
	}
	_ = authorID // 所有权在 service 层校验（UpdateDescription 校验 idea 的作者）
	return &ToolResult{OK: true, Data: map[string]any{
		"idea_id": idea.ID, "updated_at": idea.UpdatedAt,
	}}, nil
}

// ---- GetIdeaLineageTool：fork 谱系只读（源 + 直接子代 + 统计） ----

type GetIdeaLineageTool struct {
	socialSvc *SocialService
}

func NewGetIdeaLineageTool(socialSvc *SocialService) *GetIdeaLineageTool {
	return &GetIdeaLineageTool{socialSvc: socialSvc}
}

func (t *GetIdeaLineageTool) Name() string { return "get_idea_lineage" }

func (t *GetIdeaLineageTool) Description() string {
	return "Get the fork lineage of an idea: its source idea (if forked), direct fork children, " +
		"and lineage stats (total forks / active branches / contributors). Use to explore the evolution graph."
}

func (t *GetIdeaLineageTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"idea_id": stringProp("ID of the idea"),
		},
		"required": []string{"idea_id"},
	})
}

func (t *GetIdeaLineageTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	lineage, err := t.socialSvc.GetIdeaLineage(ToolStr(in, "idea_id"))
	if err != nil {
		return &ToolResult{OK: false, Error: "idea not found"}, nil
	}
	return &ToolResult{OK: true, Data: map[string]any{"lineage": lineage}}, nil
}

// ---- GetActivityFeedTool：全局动态流（对齐 GET /activity） ----

type GetActivityFeedTool struct {
	db *gorm.DB
}

func NewGetActivityFeedTool(db *gorm.DB) *GetActivityFeedTool {
	return &GetActivityFeedTool{db: db}
}

func (t *GetActivityFeedTool) Name() string { return "get_activity_feed" }

func (t *GetActivityFeedTool) Description() string {
	return "Get the global marketplace activity feed (publishes, forks, comments, status changes across all agents/users). " +
		"Use to sense what the community is working on right now."
}

func (t *GetActivityFeedTool) Parameters() json.RawMessage {
	return rawJSON(map[string]any{
		"type": "object",
		"properties": map[string]any{
			"limit": map[string]any{
				"type":        "integer",
				"description": "max records to return (default 20, max 100)",
			},
			"offset": map[string]any{
				"type":        "integer",
				"description": "pagination offset",
			},
		},
	})
}

// feedExcludeActions 与 REST /activity 保持一致：聊天内部事件不进 feed。
var feedExcludeActions = []string{"create_session", "send_message", "fork_session"}

func (t *GetActivityFeedTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	limit := ToolInt(in, "limit")
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := ToolInt(in, "offset")
	if offset < 0 {
		offset = 0
	}

	var activities []model.ActivityLog
	if err := t.db.Where("action NOT IN ?", feedExcludeActions).
		Order("created_at DESC").Limit(limit).Offset(offset).
		Find(&activities).Error; err != nil {
		return nil, fmt.Errorf("get_activity_feed failed: %w", err)
	}
	var total int64
	if err := t.db.Model(&model.ActivityLog{}).
		Where("action NOT IN ?", feedExcludeActions).
		Count(&total).Error; err != nil {
		return nil, fmt.Errorf("get_activity_feed count failed: %w", err)
	}
	return &ToolResult{OK: true, Data: map[string]any{
		"activities": activities, "total": total,
	}}, nil
}
