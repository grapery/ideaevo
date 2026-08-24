package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service"
)

// ProgressHandler idea 实现进度（待办/已完成）端点。
// 读公开（同 changelog）；写仅创建者（Agent API Key 或用户会话，同 meta 端点）。
type ProgressHandler struct {
	ideaSvc     *service.IdeaService
	agentSvc    *service.AgentService
	progressSvc *service.ProgressService
}

func NewProgressHandler(ideaSvc *service.IdeaService, agentSvc *service.AgentService, progressSvc *service.ProgressService) *ProgressHandler {
	return &ProgressHandler{ideaSvc: ideaSvc, agentSvc: agentSvc, progressSvc: progressSvc}
}

// canManageIdea 与 IdeaHandler 同规则：创建 Agent 本人，或其绑定的用户。
func (h *ProgressHandler) canManageIdea(c *gin.Context, idea *model.Idea) bool {
	if agentID := c.GetString("agent_id"); agentID != "" && idea.AgentID == agentID {
		return true
	}
	userID := c.GetString("user_id")
	if userID == "" {
		return false
	}
	agent, err := h.agentSvc.GetByID(idea.AgentID)
	if err != nil {
		return false
	}
	return agent.OwnerUserID == userID
}

// resolveActor 进度条目录入者：Agent 认证记 agent，用户会话记 user（名字取默认个人 Agent）。
func (h *ProgressHandler) resolveActor(c *gin.Context) service.ProgressActor {
	if agentID := c.GetString("agent_id"); agentID != "" {
		name := ""
		if agent, err := h.agentSvc.GetByID(agentID); err == nil {
			name = agent.Name
		}
		return service.ProgressActor{Type: "agent", ID: agentID, Name: name}
	}
	userID := c.GetString("user_id")
	name := ""
	if agent, err := h.agentSvc.EnsureDefaultUserAgent(userID); err == nil {
		name = agent.Name
	}
	return service.ProgressActor{Type: "user", ID: userID, Name: name}
}

// List 公开返回某 idea 的进度条目分组视图（匿名可读）。
func (h *ProgressHandler) List(c *gin.Context) {
	view, err := h.progressSvc.List(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "progress load failed"})
		return
	}
	c.JSON(http.StatusOK, view)
}

// Create 批量追加进度条目（仅创建者）。
func (h *ProgressHandler) Create(c *gin.Context) {
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if !h.canManageIdea(c, idea) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的创建者才能更新实现进度"})
		return
	}
	var input struct {
		Items []service.ProgressItemInput `json:"items" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	upserts := make([]service.ProgressItemUpsert, 0, len(input.Items))
	for _, in := range input.Items {
		upserts = append(upserts, service.ProgressItemUpsert{Input: in})
	}
	view, err := h.progressSvc.UpsertItems(idea.ID, upserts, h.resolveActor(c))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusCreated, view)
}

// Update 单条更新/勾选切换（仅创建者）。
func (h *ProgressHandler) Update(c *gin.Context) {
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if !h.canManageIdea(c, idea) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的创建者才能更新实现进度"})
		return
	}
	var input service.ProgressUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	item, err := h.progressSvc.UpdateItem(idea.ID, c.Param("pid"), input, h.resolveActor(c))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, item)
}

// Delete 删除单条（仅创建者）。
func (h *ProgressHandler) Delete(c *gin.Context) {
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if !h.canManageIdea(c, idea) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的创建者才能更新实现进度"})
		return
	}
	if err := h.progressSvc.DeleteItem(idea.ID, c.Param("pid")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
