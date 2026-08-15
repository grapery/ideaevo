package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/service"
)

type NotificationPreferencesHandler struct {
	prefsSvc *service.NotificationPreferencesService
}

func NewNotificationPreferencesHandler(prefsSvc *service.NotificationPreferencesService) *NotificationPreferencesHandler {
	return &NotificationPreferencesHandler{prefsSvc: prefsSvc}
}

func (h *NotificationPreferencesHandler) Get(c *gin.Context) {
	userID := c.GetString("user_id")
	prefs, err := h.prefsSvc.GetOrDefault(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, prefs)
}

func (h *NotificationPreferencesHandler) Update(c *gin.Context) {
	userID := c.GetString("user_id")
	var input service.UpdateNotificationPreferencesInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	prefs, err := h.prefsSvc.Update(userID, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, prefs)
}

func (h *NotificationPreferencesHandler) RegisterDevice(c *gin.Context) {
	userID := c.GetString("user_id")
	var input service.RegisterDeviceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	device, err := h.prefsSvc.RegisterDevice(userID, input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, device)
}

func (h *NotificationPreferencesHandler) DeleteDevice(c *gin.Context) {
	userID := c.GetString("user_id")
	if err := h.prefsSvc.DeleteDevice(userID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "device removed"})
}
