package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/service"
)

// SuggestionHandler 处理 idea 建议池的 HTTP 接口。
type SuggestionHandler struct {
	suggestionSvc *service.SuggestionService
	ideaSvc       *service.IdeaService
	assets        *service.ObjectStore
}

func NewSuggestionHandler(suggestionSvc *service.SuggestionService, ideaSvc *service.IdeaService, assets *service.ObjectStore) *SuggestionHandler {
	return &SuggestionHandler{
		suggestionSvc: suggestionSvc,
		ideaSvc:       ideaSvc,
		assets:        assets,
	}
}

// List 返回某 idea 的建议列表（公开读，viewer 投票状态由 OptionalUserAuth 注入）。
func (h *SuggestionHandler) List(c *gin.Context) {
	ideaID := c.Param("id")
	if _, err := h.ideaSvc.GetByID(ideaID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	userID, agentID := resolveActor(c)
	suggestions, err := h.suggestionSvc.ListByIdea(ideaID, userID, agentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"suggestions": suggestions})
}

// Create 提交建议（文字 + 可选图片 URL）。
func (h *SuggestionHandler) Create(c *gin.Context) {
	ideaID := c.Param("id")
	idea, err := h.ideaSvc.GetByID(ideaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if idea.Status == "buried" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "想法已埋没，无法提交建议"})
		return
	}

	var input struct {
		Content   string   `json:"content" binding:"required"`
		ImageURLs []string `json:"image_urls"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	userID, agentID := resolveActor(c)
	if userID == "" && agentID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录或提供 API Key"})
		return
	}

	suggestion, err := h.suggestionSvc.Create(service.CreateSuggestionInput{
		IdeaID:    ideaID,
		UserID:    userID,
		AgentID:   agentID,
		Content:   input.Content,
		ImageURLs: input.ImageURLs,
	})
	if err != nil {
		if errors.Is(err, service.ErrSuggestionIdeaGone) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "想法不存在或已埋没，无法提交建议"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"suggestion": suggestion})
}

// Delete 删除建议（仅提交者本人/本人 Agent）。
func (h *SuggestionHandler) Delete(c *gin.Context) {
	userID, agentID := resolveActor(c)
	if err := h.suggestionSvc.Delete(c.Param("id"), c.Param("sid"), userID, agentID); err != nil {
		switch {
		case errors.Is(err, service.ErrSuggestionNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("suggestion not found")})
		case errors.Is(err, service.ErrSuggestionNotAuthor):
			c.JSON(http.StatusForbidden, gin.H{"error": "只有建议的提交者才能删除"})
		case errors.Is(err, service.ErrSuggestionSelected):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "suggestion deleted"})
}

// Vote 给建议投票。
func (h *SuggestionHandler) Vote(c *gin.Context) {
	userID, agentID := resolveActor(c)
	if userID == "" && agentID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录或提供 API Key"})
		return
	}
	if err := h.suggestionSvc.Vote(c.Param("id"), c.Param("sid"), userID, agentID); err != nil {
		switch {
		case errors.Is(err, service.ErrSuggestionNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("suggestion not found")})
		case errors.Is(err, service.ErrSuggestionAlreadyVot):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"voted": true})
}

// Unvote 取消投票。
func (h *SuggestionHandler) Unvote(c *gin.Context) {
	userID, agentID := resolveActor(c)
	if userID == "" && agentID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录或提供 API Key"})
		return
	}
	if err := h.suggestionSvc.Unvote(c.Param("id"), c.Param("sid"), userID, agentID); err != nil {
		if errors.Is(err, service.ErrSuggestionNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("suggestion not found")})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"voted": false})
}

// Select 由 idea owner 采纳一条建议，创建实现任务。
func (h *SuggestionHandler) Select(c *gin.Context) {
	ideaID := c.Param("id")
	if _, err := h.ideaSvc.GetByID(ideaID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	userID, agentID := resolveActor(c)
	result, err := h.suggestionSvc.Select(ideaID, c.Param("sid"), userID, agentID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrSuggestionNotOwner):
			c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的拥有者才能采纳建议"})
		case errors.Is(err, service.ErrSuggestionNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("suggestion not found")})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"suggestion": result.Suggestion, "job_id": result.JobID})
}

// PresignUpload 为建议图片预签名 OSS 上传地址（任何已认证主体，不限 idea 创建者）。
func (h *SuggestionHandler) PresignUpload(c *gin.Context) {
	if h.assets == nil || !h.assets.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "上传未配置"})
		return
	}
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if idea.Status == "buried" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "想法已埋没，无法上传建议图片"})
		return
	}

	var input struct {
		ContentType string `json:"content_type" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	result, err := h.assets.PresignPut("ideas", idea.ID, "content", input.ContentType)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, result)
}

// MyJobs 返回当前用户的实现任务队列（owner 视角）。
func (h *SuggestionHandler) MyJobs(c *gin.Context) {
	userID := extractUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
		return
	}
	jobs, err := h.suggestionSvc.ListJobs(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"jobs": jobs})
}

// UpdateJob 推进任务状态（开始/完成/失败），完成时通知建议提交者。
func (h *SuggestionHandler) UpdateJob(c *gin.Context) {
	userID := extractUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
		return
	}
	var input struct {
		Status string `json:"status" binding:"required"`
		Note   string `json:"note"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	job, err := h.suggestionSvc.UpdateJob(c.Param("id"), userID, input.Status, input.Note)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrSuggestionJobNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("job not found")})
		case errors.Is(err, service.ErrSuggestionJobNotOwner):
			c.JSON(http.StatusForbidden, gin.H{"error": "只有任务的拥有者才能推进任务"})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"job": job})
}

// AnswerJobQuestion 用户在任务队列页回答本地编码 Agent 的提问（ask_user 长轮询侧收到的就是这里的内容）。
func (h *SuggestionHandler) AnswerJobQuestion(c *gin.Context) {
	userID := extractUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
		return
	}
	var input struct {
		Answer string `json:"answer" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	if err := h.suggestionSvc.AnswerQuestion(c.Param("qid"), userID, input.Answer); err != nil {
		switch {
		case errors.Is(err, service.ErrSuggestionJobNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("job not found")})
		case errors.Is(err, service.ErrSuggestionJobNotOwner):
			c.JSON(http.StatusForbidden, gin.H{"error": "只有任务的拥有者才能回答"})
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"answered": true})
}
