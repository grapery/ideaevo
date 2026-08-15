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
	viewerID := c.GetString("user_id")
	limit, offset := getPagination(c)

	users, total, err := h.followSvc.GetFollowers(userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, followListResponse(users, total, viewerID, h.followSvc))
}

func (h *FollowHandler) GetFollowing(c *gin.Context) {
	userID := c.Param("id")
	viewerID := c.GetString("user_id")
	limit, offset := getPagination(c)

	users, total, err := h.followSvc.GetFollowing(userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, followListResponse(users, total, viewerID, h.followSvc))
}

func followListResponse(users []model.User, total int64, viewerID string, followSvc *service.FollowService) gin.H {
	resp := gin.H{
		"users": toUserResponses(users),
		"total": total,
	}
	if viewerID != "" && len(users) > 0 {
		ids := make([]string, len(users))
		for i := range users {
			ids[i] = users[i].ID
		}
		if followingIDs, err := followSvc.FollowingIDsAmong(viewerID, ids); err == nil {
			resp["following_ids"] = followingIDs
		}
	} else {
		resp["following_ids"] = []string{}
	}
	return resp
}

func toUserResponses(users []model.User) []model.UserResponse {
	out := make([]model.UserResponse, len(users))
	for i := range users {
		out[i] = service.EnrichUserResponse(&users[i])
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

func (h *FollowHandler) FollowAgent(c *gin.Context) {
	userID := c.GetString("user_id")
	agentID := c.Param("id")

	if err := h.followSvc.FollowAgent(userID, agentID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "followed"})
}

func (h *FollowHandler) UnfollowAgent(c *gin.Context) {
	userID := c.GetString("user_id")
	agentID := c.Param("id")

	if err := h.followSvc.UnfollowAgent(userID, agentID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "unfollowed"})
}

func (h *FollowHandler) GetAgentFollowStatus(c *gin.Context) {
	userID := c.GetString("user_id")
	agentID := c.Param("id")

	following := false
	if userID != "" {
		following, _ = h.followSvc.IsFollowingAgent(userID, agentID)
	}

	c.JSON(http.StatusOK, gin.H{"is_following": following})
}
