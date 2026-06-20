package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service"
)

type FollowHandler struct {
	followSvc *service.FollowService
	userSvc   *service.UserService
}

func NewFollowHandler(followSvc *service.FollowService, userSvc *service.UserService) *FollowHandler {
	return &FollowHandler{followSvc: followSvc, userSvc: userSvc}
}

func (h *FollowHandler) Follow(c *gin.Context) {
	followerID := c.GetString("user_id")
	followingID := c.Param("id")

	if err := h.followSvc.Follow(followerID, followingID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "followed"})
}

func (h *FollowHandler) Unfollow(c *gin.Context) {
	followerID := c.GetString("user_id")
	followingID := c.Param("id")

	if err := h.followSvc.Unfollow(followerID, followingID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "unfollowed"})
}

func (h *FollowHandler) GetFollowers(c *gin.Context) {
	userID := c.Param("id")
	limit, offset := getPagination(c)

	users, total, err := h.followSvc.GetFollowers(userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": toUserResponses(users), "total": total})
}

func (h *FollowHandler) GetFollowing(c *gin.Context) {
	userID := c.Param("id")
	limit, offset := getPagination(c)

	users, total, err := h.followSvc.GetFollowing(userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": toUserResponses(users), "total": total})
}

func toUserResponses(users []model.User) []model.UserResponse {
	out := make([]model.UserResponse, len(users))
	for i := range users {
		out[i] = model.ToUserResponse(&users[i])
	}
	return out
}

func (h *FollowHandler) GetProfile(c *gin.Context) {
	userID := c.Param("id")

	profile, err := h.userSvc.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	viewerID := c.GetString("user_id")
	isFollowing := false
	if viewerID != "" && viewerID != userID {
		isFollowing, _ = h.followSvc.IsFollowing(viewerID, userID)
	}

	c.JSON(http.StatusOK, gin.H{
		"profile":      profile,
		"is_following": isFollowing,
	})
}
