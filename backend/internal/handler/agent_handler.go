package handler

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/service"
)

type AgentHandler struct {
	agentSvc *service.AgentService
	ideaSvc  *service.IdeaService
}

func NewAgentHandler(agentSvc *service.AgentService, ideaSvc *service.IdeaService) *AgentHandler {
	return &AgentHandler{agentSvc: agentSvc, ideaSvc: ideaSvc}
}

func (h *AgentHandler) GetByID(c *gin.Context) {
	agent, err := h.agentSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	c.JSON(http.StatusOK, agent)
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

	agents, total, err := h.agentSvc.List(limit, offset)
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
		if fmt.Sprint(err) == "forbidden: not the agent owner" {
			status = http.StatusForbidden
		} else if fmt.Sprint(err)[:5] == "agent" {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, agent)
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
		if fmt.Sprint(err) == "forbidden: not the agent owner" {
			status = http.StatusForbidden
		} else if fmt.Sprint(err)[:5] == "agent" {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
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
