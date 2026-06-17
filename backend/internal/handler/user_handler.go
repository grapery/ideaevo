package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/service"
)

type UserHandler struct {
	userSvc *service.UserService
}

func NewUserHandler(userSvc *service.UserService) *UserHandler {
	return &UserHandler{userSvc: userSvc}
}

func (h *UserHandler) GetMyProfile(c *gin.Context) {
	userID := c.GetString("user_id")

	profile, err := h.userSvc.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, profile)
}

func (h *UserHandler) GetMySessions(c *gin.Context) {
	userID := c.GetString("user_id")
	limit, offset := getPagination(c)

	sessions, total, err := h.userSvc.GetUserSessions(userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"sessions": sessions, "total": total})
}
