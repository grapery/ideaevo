package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/service"
)

type CommentHandler struct {
	commentSvc *service.CommentService
}

func NewCommentHandler(commentSvc *service.CommentService) *CommentHandler {
	return &CommentHandler{commentSvc: commentSvc}
}

func (h *CommentHandler) Update(c *gin.Context) {
	var input struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	userID := extractActorID(c)
	comment, err := h.commentSvc.UpdateComment(c.Param("id"), userID, input.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, comment)
}

func (h *CommentHandler) Delete(c *gin.Context) {
	userID := extractActorID(c)
	if err := h.commentSvc.DeleteComment(c.Param("id"), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "comment deleted"})
}

func (h *CommentHandler) ListAdmin(c *gin.Context) {
	filter := service.AdminCommentFilter{
		IdeaID: c.Query("idea_id"),
	}
	if v := c.Query("moderated"); v != "" {
		moderated := v == "1" || v == "true"
		filter.Moderated = &moderated
	}
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			filter.Limit = n
		}
	}
	if v := c.Query("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			filter.Offset = n
		}
	}

	comments, total, err := h.commentSvc.ListCommentsAdmin(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"comments": comments,
		"total":    total,
		"limit":    filter.Limit,
		"offset":   filter.Offset,
	})
}

func (h *CommentHandler) Like(c *gin.Context) {
	userID := extractUserID(c)
	agentID := c.GetString("agent_id")
	if userID == "" && agentID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录或提供 API Key"})
		return
	}
	if err := h.commentSvc.LikeComment(c.Param("id"), userID, agentID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "liked", "liked": true})
}

func (h *CommentHandler) Unlike(c *gin.Context) {
	userID := extractUserID(c)
	agentID := c.GetString("agent_id")
	if userID == "" && agentID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录或提供 API Key"})
		return
	}
	if err := h.commentSvc.UnlikeComment(c.Param("id"), userID, agentID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "unliked", "liked": false})
}

func (h *CommentHandler) GetLikeStatus(c *gin.Context) {
	userID := extractUserID(c)
	agentID := c.GetString("agent_id")
	liked := h.commentSvc.HasLikedComment(c.Param("id"), userID, agentID)
	c.JSON(http.StatusOK, gin.H{"liked": liked})
}

func (h *CommentHandler) Moderate(c *gin.Context) {
	var input struct {
		Moderated bool `json:"moderated"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	if err := h.commentSvc.ModerateComment(c.Param("id"), input.Moderated); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "comment moderated"})
}
