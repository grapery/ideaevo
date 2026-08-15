package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/service"
)

// ChatAttachmentHandler 处理聊天附件（图片 / Markdown 文档）的上传预签名、finalize 与配额查询。
type ChatAttachmentHandler struct {
	attachmentSvc *service.ChatAttachmentService
}

func NewChatAttachmentHandler(attachmentSvc *service.ChatAttachmentService) *ChatAttachmentHandler {
	return &ChatAttachmentHandler{attachmentSvc: attachmentSvc}
}

// PresignChatFile 预签名一个聊天附件上传 URL（浏览器直传 OSS）。
// POST /api/user/chat-files/presign
func (h *ChatAttachmentHandler) PresignChatFile(c *gin.Context) {
	userID := c.GetString("user_id")
	var input struct {
		Kind        string `json:"kind" binding:"required"`         // image | document
		ContentType string `json:"content_type" binding:"required"`
		FileName    string `json:"file_name"`
		FileSize    int64  `json:"file_size" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	if h.attachmentSvc == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": FriendlyMessage("upload not configured")})
		return
	}
	result, err := h.attachmentSvc.PresignChatFile(userID, service.PresignChatFileInput{
		Kind:        input.Kind,
		ContentType: input.ContentType,
		FileName:    input.FileName,
		FileSize:    input.FileSize,
	})
	if err != nil {
		writeChatFileError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

// FinalizeChatFile 校验已上传对象并落库附件元数据（含摘要）。
// POST /api/user/chat-files/finalize
func (h *ChatAttachmentHandler) FinalizeChatFile(c *gin.Context) {
	userID := c.GetString("user_id")
	var input struct {
		Kind     string `json:"kind" binding:"required"`
		Key      string `json:"key" binding:"required"`
		FileName string `json:"file_name"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	if h.attachmentSvc == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": FriendlyMessage("upload not configured")})
		return
	}
	att, err := h.attachmentSvc.FinalizeChatFile(userID, service.FinalizeInput{
		Kind:     input.Kind,
		Key:      input.Key,
		FileName: input.FileName,
	})
	if err != nil {
		writeChatFileError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"attachment": att})
}

// GetChatFileQuota 返回用户个人存储空间用量与上限（付费用户 limit=-1 不限）。
// GET /api/user/chat-files/quota
func (h *ChatAttachmentHandler) GetChatFileQuota(c *gin.Context) {
	userID := c.GetString("user_id")
	if h.attachmentSvc == nil {
		c.JSON(http.StatusOK, gin.H{"used": 0, "limit": -1})
		return
	}
	used, limit, err := h.attachmentSvc.StorageUsage(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"used": used, "limit": limit})
}

// writeChatFileError 把附件服务错误映射到合适的 HTTP 状态码。
func writeChatFileError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrStorageQuotaExceeded):
		c.JSON(http.StatusPaymentRequired, gin.H{"error": ServiceError(err), "code": "storage_quota_exceeded"})
	case errors.Is(err, service.ErrAttachmentKindInvalid):
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
	case errors.Is(err, service.ErrAttachmentNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": ServiceError(err)})
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
	}
}
