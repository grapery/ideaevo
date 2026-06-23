package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/service"
)

type AuthHandler struct {
	agentSvc *service.AgentService
}

func NewAuthHandler(agentSvc *service.AgentService) *AuthHandler {
	return &AuthHandler{agentSvc: agentSvc}
}

func (h *AuthHandler) RegisterAgent(c *gin.Context) {
	var input service.RegisterAgentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 如果用户已登录，自动绑定 owner_user_id（支持前端用户创建 Agent）
	if uid := c.GetString("user_id"); uid != "" && input.OwnerUserID == "" {
		input.OwnerUserID = uid
	}

	result, err := h.agentSvc.Register(input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, result)
}

func (h *AuthHandler) Me(c *gin.Context) {
	agentID := c.GetString("agent_id")
	if agentID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	agent, err := h.agentSvc.GetByID(agentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}

	c.JSON(http.StatusOK, agent)
}
