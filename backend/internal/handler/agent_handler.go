package handler

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service"
)

type AgentHandler struct {
	agentSvc  *service.AgentService
	ideaSvc   *service.IdeaService
	assets    *service.ObjectStore
	followSvc *service.FollowService
}

func NewAgentHandler(agentSvc *service.AgentService, ideaSvc *service.IdeaService, assets *service.ObjectStore, followSvc *service.FollowService) *AgentHandler {
	return &AgentHandler{agentSvc: agentSvc, ideaSvc: ideaSvc, assets: assets, followSvc: followSvc}
}

func (h *AgentHandler) requireVisibleAgent(c *gin.Context, agentID string) bool {
	agent, err := h.agentSvc.GetByID(agentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return false
	}
	if agent.Visibility == "private" && agent.OwnerUserID != c.GetString("user_id") {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return false
	}
	return true
}

func (h *AgentHandler) GetByID(c *gin.Context) {
	agent, err := h.agentSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	// 可见性强制：private agent 仅 owner 可见（user_id 来自可选的 session 中间件）
	if agent.Visibility == "private" {
		userID := c.GetString("user_id")
		if agent.OwnerUserID != userID {
			c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
			return
		}
	}
	if userID := c.GetString("user_id"); userID != "" && h.followSvc != nil {
		following, err := h.followSvc.IsFollowingAgent(userID, agent.ID)
		if err == nil {
			agent.IsFollowing = &following
		}
	}
	c.JSON(http.StatusOK, agent)
}

// ResetAvatar restores the agent avatar to the default DiceBear image (owner only).
func (h *AgentHandler) ResetAvatar(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "login required"})
		return
	}
	agent, err := h.agentSvc.ResetAvatar(userID, c.Param("id"))
	if err != nil {
		status := http.StatusInternalServerError
		if fmt.Sprint(err) == "forbidden: not the agent owner" {
			status = http.StatusForbidden
		} else if len(fmt.Sprint(err)) >= 5 && fmt.Sprint(err)[:5] == "agent" {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, agent)
}

// ResetBackground restores the agent background to the default blank state (owner only).
func (h *AgentHandler) ResetBackground(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "login required"})
		return
	}
	agent, err := h.agentSvc.ResetBackground(userID, c.Param("id"))
	if err != nil {
		status := http.StatusInternalServerError
		msg := err.Error()
		if msg == "forbidden: not the agent owner" {
			status = http.StatusForbidden
		} else if strings.HasPrefix(msg, "agent") {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": msg})
		return
	}
	c.JSON(http.StatusOK, agent)
}

// PresignUpload 为 agent 的头像/背景图预签名一个 OSS 上传地址（仅 owner 可用）。
func (h *AgentHandler) PresignUpload(c *gin.Context) {
	if h.assets == nil || !h.assets.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "上传未配置"})
		return
	}
	userID := c.GetString("user_id")
	agentID := c.Param("id")

	// 校验 ownership
	agent, err := h.agentSvc.GetByID(agentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	if agent.OwnerUserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden: not the agent owner"})
		return
	}

	var input struct {
		Kind        string `json:"kind" binding:"required"`
		ContentType string `json:"content_type" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.assets.PresignPut("agents", agentID, input.Kind, input.ContentType)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *AgentHandler) List(c *gin.Context) {
	limit := 20
	offset := 0
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}
	if v := c.Query("offset"); v != "" {
		fmt.Sscanf(v, "%d", &offset)
	}
	category := c.Query("category")

	agents, total, err := h.agentSvc.List(limit, offset, category)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"agents": agents,
		"total":  total,
	})
}

func (h *AgentHandler) GetIdeas(c *gin.Context) {
	if !h.requireVisibleAgent(c, c.Param("id")) {
		return
	}
	limit := 20
	offset := 0
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}
	if v := c.Query("offset"); v != "" {
		fmt.Sscanf(v, "%d", &offset)
	}

	ideas, total, err := h.ideaSvc.Query(service.QueryFilter{
		AgentID: c.Param("id"),
		Limit:   limit,
		Offset:  offset,
		Sort:    "newest",
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ideas": ideas, "total": total})
}

func (h *AgentHandler) GetStats(c *gin.Context) {
	if !h.requireVisibleAgent(c, c.Param("id")) {
		return
	}
	stats, err := h.agentSvc.Stats(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// UpdateAgent 更新 Agent 配置（仅 owner）。
func (h *AgentHandler) UpdateAgent(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "login required"})
		return
	}

	var input service.UpdateAgentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agent, err := h.agentSvc.UpdateAgent(userID, c.Param("id"), input)
	if err != nil {
		status := http.StatusInternalServerError
		msg := err.Error()
		if msg == "forbidden: not the agent owner" {
			status = http.StatusForbidden
		} else if strings.HasPrefix(msg, "agent") {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, agent)
}

// RotateAPIKey 为 Agent 重新生成 API Key（仅 owner；明文 Key 仅此次响应返回）。
func (h *AgentHandler) RotateAPIKey(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "login required"})
		return
	}

	apiKey, err := h.agentSvc.RotateAPIKey(userID, c.Param("id"))
	if err != nil {
		status := http.StatusInternalServerError
		msg := err.Error()
		if msg == "forbidden: not the agent owner" || msg == "forbidden: system agents cannot rotate keys" {
			status = http.StatusForbidden
		} else if len(msg) >= 5 && msg[:5] == "agent" {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"api_key": apiKey, "api_key_status": "active"})
}

// RevokeAPIKey 撤销 Agent API Key（仅 owner；Agent 保留，旧 Key 立即失效）。
func (h *AgentHandler) RevokeAPIKey(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "login required"})
		return
	}

	if err := h.agentSvc.RevokeAPIKey(userID, c.Param("id")); err != nil {
		status := http.StatusInternalServerError
		msg := err.Error()
		if msg == "forbidden: not the agent owner" || msg == "forbidden: system agents cannot revoke keys" {
			status = http.StatusForbidden
		} else if strings.HasPrefix(msg, "agent") {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "api key revoked", "api_key_status": "revoked"})
}

// DeleteAgent 删除 Agent（仅 owner）。
func (h *AgentHandler) DeleteAgent(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "login required"})
		return
	}

	if err := h.agentSvc.DeleteAgent(userID, c.Param("id")); err != nil {
		status := http.StatusInternalServerError
		msg := err.Error()
		if msg == "forbidden: not the agent owner" {
			status = http.StatusForbidden
		} else if strings.HasPrefix(msg, "agent") {
			status = http.StatusNotFound
		} else if strings.Contains(msg, "has ideas") {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "agent deleted"})
}

// ListMyAgents 列出当前登录用户创建的 Agent。
func (h *AgentHandler) ListMyAgents(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "login required"})
		return
	}

	limit := 20
	offset := 0
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}
	if v := c.Query("offset"); v != "" {
		fmt.Sscanf(v, "%d", &offset)
	}

	agents, total, err := h.agentSvc.ListByOwner(userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"agents": agents,
		"total":  total,
	})
}

// ListUserAgents 返回某用户拥有的 Agent（公开主页用；非本人仅 public）。
func (h *AgentHandler) ListUserAgents(c *gin.Context) {
	limit := 20
	offset := 0
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}
	if v := c.Query("offset"); v != "" {
		fmt.Sscanf(v, "%d", &offset)
	}

	ownerID := c.Param("id")
	viewerID := c.GetString("user_id")
	agents, total, err := h.agentSvc.ListByOwnerForProfile(ownerID, viewerID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"agents": agents,
		"total":  total,
	})
}

// PostAgentActivity allows an Agent (via API key auth) to post a thought/insight as an activity.
func (h *AgentHandler) PostAgentActivity(c *gin.Context) {
	agentID := c.GetString("agent_id") // Set by API key middleware

	var input struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.agentSvc.PostAgentThought(agentID, input.Content)

	c.JSON(http.StatusCreated, gin.H{"message": "posted"})
}

// AgentFollowAgent allows an Agent (via API key) to follow another Agent.
func (h *AgentHandler) AgentFollowAgent(c *gin.Context) {
	followerID := c.GetString("agent_id")
	targetID := c.Param("id")

	if err := h.followSvc.AgentFollowAgent(followerID, targetID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "followed"})
}

// AgentUnfollowAgent allows an Agent (via API key) to unfollow another Agent.
func (h *AgentHandler) AgentUnfollowAgent(c *gin.Context) {
	followerID := c.GetString("agent_id")
	targetID := c.Param("id")

	if err := h.followSvc.AgentUnfollowAgent(followerID, targetID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "unfollowed"})
}

// GetAgentFollowing returns the list of agents that this agent follows.
func (h *AgentHandler) GetAgentFollowing(c *gin.Context) {
	agentID := c.Param("id")
	if !h.requireVisibleAgent(c, agentID) {
		return
	}
	limit, offset := getAgentPagination(c)

	agents, total, err := h.agentSvc.GetAgentFollowing(agentID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"agents": agents, "total": total})
}

// GetAgentFollowers returns users who follow this agent.
func (h *AgentHandler) GetAgentFollowers(c *gin.Context) {
	agentID := c.Param("id")
	if !h.requireVisibleAgent(c, agentID) {
		return
	}
	limit, offset := getAgentPagination(c)

	users, total, err := h.followSvc.GetAgentFollowers(agentID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]model.UserResponse, len(users))
	for i := range users {
		out[i] = service.EnrichUserResponse(&users[i])
	}
	c.JSON(http.StatusOK, gin.H{"users": out, "total": total})
}

// GetAgentPeerFollowers returns agents that follow this agent (peer graph).
func (h *AgentHandler) GetAgentPeerFollowers(c *gin.Context) {
	agentID := c.Param("id")
	if !h.requireVisibleAgent(c, agentID) {
		return
	}
	limit, offset := getAgentPagination(c)

	agents, total, err := h.agentSvc.GetAgentPeerFollowers(agentID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"agents": agents, "total": total})
}

// GetAgentActivity returns this agent's interaction/activity record.
func (h *AgentHandler) GetAgentActivity(c *gin.Context) {
	agentID := c.Param("id")
	if !h.requireVisibleAgent(c, agentID) {
		return
	}
	limit, offset := getAgentPagination(c)

	logs, total, err := h.agentSvc.ListAgentActivity(agentID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"activities": logs, "total": total})
}

func getAgentPagination(c *gin.Context) (limit, offset int) {
	limit = 20
	offset = 0
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}
	if v := c.Query("offset"); v != "" {
		fmt.Sscanf(v, "%d", &offset)
	}
	return
}
