package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service"
)

type ModerationHandler struct {
	modSvc *service.ModerationService
}

func NewModerationHandler(modSvc *service.ModerationService) *ModerationHandler {
	return &ModerationHandler{modSvc: modSvc}
}

func (h *ModerationHandler) ListBlocks(c *gin.Context) {
	userID := c.GetString("user_id")
	users, err := h.modSvc.ListBlockedUsers(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]model.UserResponse, len(users))
	for i := range users {
		out[i] = service.EnrichUserResponse(&users[i])
	}
	c.JSON(http.StatusOK, gin.H{"users": out, "total": len(out)})
}

func (h *ModerationHandler) GetBlockStatus(c *gin.Context) {
	viewerID := c.GetString("user_id")
	targetID := c.Param("id")
	blocked, blockedBy, err := h.modSvc.BlockStatus(viewerID, targetID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"blocked":      blocked,
		"blocked_by":   blockedBy,
		"can_interact": !blocked && !blockedBy,
	})
}

func (h *ModerationHandler) BlockUser(c *gin.Context) {
	blockerID := c.GetString("user_id")
	blockedID := c.Param("id")
	if err := h.modSvc.BlockUser(blockerID, blockedID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "blocked"})
}

func (h *ModerationHandler) UnblockUser(c *gin.Context) {
	blockerID := c.GetString("user_id")
	blockedID := c.Param("id")
	if err := h.modSvc.UnblockUser(blockerID, blockedID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "unblocked"})
}

func (h *ModerationHandler) SubmitReport(c *gin.Context) {
	reporterID := c.GetString("user_id")
	var input struct {
		TargetType string `json:"target_type" binding:"required"`
		TargetID   string `json:"target_id" binding:"required"`
		Reason     string `json:"reason" binding:"required"`
		Detail     string `json:"detail"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	if err := h.modSvc.SubmitReport(reporterID, input.TargetType, input.TargetID, input.Reason, input.Detail); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "report submitted"})
}
