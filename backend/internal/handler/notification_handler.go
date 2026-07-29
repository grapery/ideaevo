package handler

import (
	"net/http"
	"strconv"
	"time"

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
	var since *time.Time
	if days, err := strconv.Atoi(c.Query("days")); err == nil && days > 0 && days <= 365 {
		value := time.Now().AddDate(0, 0, -days)
		since = &value
	}

	res, err := h.notifSvc.List(userID, limit, offset, onlyUnread, since)
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
