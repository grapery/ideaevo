package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service"
)

var validStatuses = map[string]bool{
	"active": true, "buried": true, "archived": true, "implemented": true,
}

type IdeaHandler struct {
	ideaSvc       *service.IdeaService
	agentSvc      *service.AgentService
	socialSvc     *service.SocialService
	wanyeSvc      *service.WanyeService
	systemAgentID string
}

func NewIdeaHandler(ideaSvc *service.IdeaService, agentSvc *service.AgentService, socialSvc *service.SocialService, wanyeSvc *service.WanyeService, systemAgentID string) *IdeaHandler {
	return &IdeaHandler{
		ideaSvc:       ideaSvc,
		agentSvc:      agentSvc,
		socialSvc:     socialSvc,
		wanyeSvc:      wanyeSvc,
		systemAgentID: systemAgentID,
	}
}

func (h *IdeaHandler) Register(c *gin.Context) {
	var input service.RegisterIdeaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agentID := c.GetString("agent_id")
	idea, warning, err := h.ideaSvc.Register(agentID, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"idea":    idea,
		"warning": warning,
	})
}

func (h *IdeaHandler) GetByID(c *gin.Context) {
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "idea not found"})
		return
	}
	c.JSON(http.StatusOK, idea)
}

func (h *IdeaHandler) Query(c *gin.Context) {
	var filter service.QueryFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ideas, total, err := h.ideaSvc.Query(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ideas":  ideas,
		"total":  total,
		"limit":  filter.Limit,
		"offset": filter.Offset,
	})
}

func (h *IdeaHandler) Search(c *gin.Context) {
	query := c.Query("q")
	threshold := 0.3
	limit := 10
	page := 1

	if v := c.Query("threshold"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			threshold = f
		}
	}
	if v := c.Query("limit"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			limit = i
		}
	}
	if v := c.Query("page"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			page = i
		}
	}
	offset := (page - 1) * limit

	results, err := h.ideaSvc.Search(query, threshold, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": results,
		"page":    page,
		"limit":   limit,
		"offset":  offset,
	})
}

func (h *IdeaHandler) Bury(c *gin.Context) {
	agentID := c.GetString("agent_id")
	var input struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	idea, err := h.ideaSvc.Bury(c.Param("id"), agentID, input.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, idea)
}

func (h *IdeaHandler) UpdateStatus(c *gin.Context) {
	agentID := c.GetString("agent_id")
	var input struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !validStatuses[input.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status, must be one of: active, buried, archived, implemented"})
		return
	}

	// 权限校验：只有 idea 的创建者 Agent 才能修改状态
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "idea not found"})
		return
	}
	if idea.AgentID != agentID {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的创建者才能修改状态"})
		return
	}

	idea, err = h.ideaSvc.UpdateStatus(c.Param("id"), input.Status)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, idea)
}

func (h *IdeaHandler) Like(c *gin.Context) {
	ideaID := c.Param("id")
	if _, err := h.ideaSvc.GetByID(ideaID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "idea not found"})
		return
	}

	agentIDStr := c.GetString("agent_id")
	userID := extractUserID(c)
	if userID == "" && agentIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录或提供 API Key"})
		return
	}

	if err := h.socialSvc.LikeIdea(ideaID, userID, agentIDStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "liked"})
}

func (h *IdeaHandler) GetLikeStatus(c *gin.Context) {
	ideaID := c.Param("id")
	if _, err := h.ideaSvc.GetByID(ideaID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "idea not found"})
		return
	}

	agentIDStr := c.GetString("agent_id")
	userID := extractUserID(c)
	if userID == "" && agentIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录或提供 API Key"})
		return
	}

	liked := h.socialSvc.HasLikedIdea(ideaID, userID, agentIDStr)
	c.JSON(http.StatusOK, gin.H{"liked": liked})
}

func (h *IdeaHandler) Unlike(c *gin.Context) {
	ideaID := c.Param("id")
	if _, err := h.ideaSvc.GetByID(ideaID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "idea not found"})
		return
	}

	agentIDStr := c.GetString("agent_id")
	userID := extractUserID(c)

	h.socialSvc.UnlikeIdea(ideaID, userID, agentIDStr)
	c.JSON(http.StatusOK, gin.H{"message": "unliked"})
}

func (h *IdeaHandler) SendFlowers(c *gin.Context) {
	ideaID := c.Param("id")
	idea, err := h.ideaSvc.GetByID(ideaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "idea not found"})
		return
	}
	if idea.Status != model.IdeaStatusActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot send flowers to inactive idea"})
		return
	}

	var input struct {
		Message string `json:"message"`
	}
	c.ShouldBindJSON(&input)

	agentIDStr := c.GetString("agent_id")
	userID := extractUserID(c)

	if err := h.socialSvc.SendFlowers(service.SendFlowersInput{
		IdeaID:  ideaID,
		UserID:  userID,
		AgentID: agentIDStr,
		Message: input.Message,
	}); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "flowers sent"})
}

func (h *IdeaHandler) Fork(c *gin.Context) {
	ideaID := c.Param("id")
	idea, err := h.ideaSvc.GetByID(ideaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "idea not found"})
		return
	}
	if idea.Status != model.IdeaStatusActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot fork inactive idea"})
		return
	}

	var input struct {
		Title       string `json:"title" binding:"required"`
		Description string `json:"description" binding:"required"`
		Reason      string `json:"reason" binding:"required"`
		Category    string `json:"category"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	agentIDStr := extractAgentID(c, h.systemAgentID)
	if agentIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录或提供 API Key"})
		return
	}

	newIdea, err := h.socialSvc.ForkIdea(service.ForkIdeaInput{
		IdeaID:      ideaID,
		AgentID:     agentIDStr,
		Title:       input.Title,
		Description: input.Description,
		Reason:      input.Reason,
		Category:    input.Category,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, newIdea)
}

func (h *IdeaHandler) GetComments(c *gin.Context) {
	comments, err := h.wanyeSvc.GetComments(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, comments)
}

func (h *IdeaHandler) CreateComment(c *gin.Context) {
	ideaID := c.Param("id")
	idea, err := h.ideaSvc.GetByID(ideaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "idea not found"})
		return
	}
	if idea.Status != model.IdeaStatusActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot comment on inactive idea"})
		return
	}

	var input service.CreateCommentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	input.IdeaID = ideaID

	if input.UserID == "" {
		input.UserID = extractActorID(c)
	}
	if input.UserID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录或提供 API Key"})
		return
	}

	comment, err := h.wanyeSvc.CreateComment(input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, comment)
}

func (h *IdeaHandler) GetForks(c *gin.Context) {
	forks, err := h.socialSvc.GetForks(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, forks)
}
