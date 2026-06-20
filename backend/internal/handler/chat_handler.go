package handler

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/service"
)

type ChatHandler struct {
	chatSvc *service.ChatService
}

func NewChatHandler(chatSvc *service.ChatService) *ChatHandler {
	return &ChatHandler{chatSvc: chatSvc}
}

func (h *ChatHandler) CreateSession(c *gin.Context) {
	userID := c.GetString("user_id")

	var input service.CreateSessionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	session, err := h.chatSvc.CreateSession(userID, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"session": session})
}

func (h *ChatHandler) ListSessions(c *gin.Context) {
	userID := c.GetString("user_id")
	limit, offset := getPagination(c)

	sessions, total, err := h.chatSvc.ListSessions(userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"sessions": sessions, "total": total})
}

func (h *ChatHandler) GetSession(c *gin.Context) {
	userID := c.GetString("user_id")
	sessionID := c.Param("id")

	session, err := h.chatSvc.GetSession(sessionID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, session)
}

func (h *ChatHandler) RenameSession(c *gin.Context) {
	userID := c.GetString("user_id")
	sessionID := c.Param("id")

	var body struct {
		Title string `json:"title" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.chatSvc.RenameSession(sessionID, userID, body.Title); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "renamed"})
}

func (h *ChatHandler) DeleteSession(c *gin.Context) {
	userID := c.GetString("user_id")
	sessionID := c.Param("id")

	if err := h.chatSvc.DeleteSession(sessionID, userID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *ChatHandler) SendMessage(c *gin.Context) {
	userID := c.GetString("user_id")
	sessionID := c.Param("id")

	var input service.SendMessageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.chatSvc.SendMessage(sessionID, userID, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *ChatHandler) SendMessageStream(c *gin.Context) {
	userID := c.GetString("user_id")
	sessionID := c.Param("id")
	content := c.Query("content")
	if content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "content is required"})
		return
	}

	streamCh, userMsg, err := h.chatSvc.SendMessageStream(sessionID, userID, content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	c.SSEvent("user_message", userMsg)
	c.Writer.Flush()

	for chunk := range streamCh {
		if chunk.Error != nil {
			c.SSEvent("error", gin.H{"error": chunk.Error.Error()})
			c.Writer.Flush()
			return
		}
		if chunk.Done {
			c.SSEvent("done", gin.H{"message": "complete"})
			c.Writer.Flush()
			return
		}
		// 进度事件（tool_call / tool_result / assistant_message）
		if chunk.Event != nil {
			c.SSEvent(chunk.Event.Type, chunk.Event.Data)
			c.Writer.Flush()
			continue
		}
		// 普通文本增量
		fmt.Fprintf(c.Writer, "data: %s\n\n", chunk.Content)
		c.Writer.Flush()
	}
}

func (h *ChatHandler) GetMessages(c *gin.Context) {
	userID := c.GetString("user_id")
	sessionID := c.Param("id")
	beforeID := c.Query("before_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	messages, err := h.chatSvc.GetMessages(sessionID, userID, beforeID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

func (h *ChatHandler) SetMessageFeedback(c *gin.Context) {
	userID := c.GetString("user_id")
	sessionID := c.Param("id")
	messageID := c.Param("message_id")

	var body struct {
		Rating string `json:"rating" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rating, err := h.chatSvc.SetMessageFeedback(sessionID, messageID, userID, body.Rating)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user_feedback": rating})
}

func (h *ChatHandler) ClearMessageFeedback(c *gin.Context) {
	userID := c.GetString("user_id")
	sessionID := c.Param("id")
	messageID := c.Param("message_id")

	if err := h.chatSvc.ClearMessageFeedback(sessionID, messageID, userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

func (h *ChatHandler) ForkSession(c *gin.Context) {
	userID := c.GetString("user_id")
	sessionID := c.Param("id")

	var input service.ForkSessionInput
	_ = c.ShouldBindJSON(&input)

	session, err := h.chatSvc.ForkSession(sessionID, userID, input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"session": session})
}

func getPagination(c *gin.Context) (limit, offset int) {
	limit, _ = strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ = strconv.Atoi(c.DefaultQuery("offset", "0"))
	return
}
