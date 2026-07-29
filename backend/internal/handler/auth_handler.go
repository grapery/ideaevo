package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/service"
)

type AuthHandler struct {
	agentSvc *service.AgentService
	subSvc   *service.SubscriptionService // 可选：启用后校验 Agent 创建权限（需付费会员）
}

func NewAuthHandler(agentSvc *service.AgentService) *AuthHandler {
	return &AuthHandler{agentSvc: agentSvc}
}

// SetSubscription 注入会员服务以启用 Agent 创建权限校验。
func (h *AuthHandler) SetSubscription(subSvc *service.SubscriptionService) {
	h.subSvc = subSvc
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

	// 创建 Agent 权限校验：需付费会员，且未达上限（10 个）。
	// 系统创建（OwnerUserID 为空，如 bootstrap 的系统助手）不受此限制。
	if input.OwnerUserID != "" && h.subSvc != nil {
		if err := h.subSvc.CanCreateAgent(input.OwnerUserID); err != nil {
			status := http.StatusForbidden
			if errors.Is(err, service.ErrSubscriptionRequired) {
				status = http.StatusPaymentRequired
			}
			c.JSON(status, gin.H{"error": err.Error(), "code": "subscription_required"})
			return
		}
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
