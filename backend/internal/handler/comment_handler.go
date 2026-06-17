package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/service"
)

type CommentHandler struct {
	wanyeSvc *service.WanyeService
}

func NewCommentHandler(wanyeSvc *service.WanyeService) *CommentHandler {
	return &CommentHandler{wanyeSvc: wanyeSvc}
}

func (h *CommentHandler) Update(c *gin.Context) {
	var input struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := extractActorID(c)
	comment, err := h.wanyeSvc.UpdateComment(c.Param("id"), userID, input.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, comment)
}

func (h *CommentHandler) Delete(c *gin.Context) {
	userID := extractActorID(c)
	if err := h.wanyeSvc.DeleteComment(c.Param("id"), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "comment deleted"})
}

func (h *CommentHandler) Moderate(c *gin.Context) {
	var input struct {
		Moderated bool `json:"moderated"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.wanyeSvc.ModerateComment(c.Param("id"), input.Moderated); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "comment moderated"})
}
