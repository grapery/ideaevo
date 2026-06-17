package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/service"
)

type NotificationHandler struct {
	notifSvc *service.NotificationService
}

func NewNotificationHandler(notifSvc *service.NotificationService) *NotificationHandler {
	return &NotificationHandler{notifSvc: notifSvc}
}

func (h *NotificationHandler) List(c *gin.Context) {
	userID := c.GetString("user_id")
	limit, offset := getPagination(c)
	onlyUnread := c.Query("unread") == "1"

	res, err := h.notifSvc.List(userID, limit, offset, onlyUnread)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (h *NotificationHandler) UnreadCount(c *gin.Context) {
	userID := c.GetString("user_id")
	n := h.notifSvc.UnreadCount(userID)
	c.JSON(http.StatusOK, gin.H{"unread": n})
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	userID := c.GetString("user_id")
	id := c.Param("id")
	if err := h.notifSvc.MarkRead(userID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	userID := c.GetString("user_id")
	if err := h.notifSvc.MarkAllRead(userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

// Settings handlers (profile/password)

type SettingsHandler struct {
	notifSvc *service.NotificationService
}

func NewSettingsHandler(notifSvc *service.NotificationService) *SettingsHandler {
	return &SettingsHandler{notifSvc: notifSvc}
}

func (h *SettingsHandler) UpdateProfile(c *gin.Context) {
	userID := c.GetString("user_id")
	var input service.UpdateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.notifSvc.UpdateProfile(userID, input); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "profile updated"})
}

func (h *SettingsHandler) ChangePassword(c *gin.Context) {
	userID := c.GetString("user_id")
	var input service.ChangePasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// length safety
	if len(input.NewPassword) < 6 || len(input.NewPassword) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password must be 6-128 chars"})
		return
	}
	if err := h.notifSvc.ChangePassword(userID, input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "password changed"})
}
