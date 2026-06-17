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
