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
	assets        *service.ObjectStore
	systemAgentID string
}

func NewIdeaHandler(ideaSvc *service.IdeaService, agentSvc *service.AgentService, socialSvc *service.SocialService, wanyeSvc *service.WanyeService, assets *service.ObjectStore, systemAgentID string) *IdeaHandler {
	return &IdeaHandler{
		ideaSvc:       ideaSvc,
		agentSvc:      agentSvc,
		socialSvc:     socialSvc,
		wanyeSvc:      wanyeSvc,
		assets:        assets,
		systemAgentID: systemAgentID,
	}
}

func (h *IdeaHandler) canManageIdea(c *gin.Context, idea *model.Idea) bool {
	if agentID := c.GetString("agent_id"); agentID != "" && idea.AgentID == agentID {
		return true
	}
	userID := c.GetString("user_id")
	if userID == "" {
		return false
	}
	agent, err := h.agentSvc.GetByID(idea.AgentID)
	if err != nil {
		return false
	}
	return agent.OwnerUserID == userID
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

// UpdateMeta 更新想法可选附加信息（实现状态、仓库、演示、图标），仅创建者可操作。
func (h *IdeaHandler) UpdateMeta(c *gin.Context) {
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "idea not found"})
		return
	}
	if !h.canManageIdea(c, idea) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的创建者才能更新附加信息"})
		return
	}

	var input service.UpdateIdeaMetaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	idea, err = h.ideaSvc.UpdateMeta(idea.ID, input, h.assets)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, idea)
}

// PresignIcon 为想法图标预签名 OSS 上传地址（仅创建者可用）。
func (h *IdeaHandler) PresignIcon(c *gin.Context) {
	if h.assets == nil || !h.assets.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "上传未配置"})
		return
	}

	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "idea not found"})
		return
	}
	if !h.canManageIdea(c, idea) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的创建者才能上传图标"})
		return
	}

	var input struct {
		ContentType string `json:"content_type" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.assets.PresignPut("ideas", idea.ID, "icon", input.ContentType)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
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

// Share 记录一次分享事件（轻量：不复制 idea、不改计数），使该想法出现在 feed 流里。
// 鉴权与 fork 同组（AgentOrUserAuth）：API Key → actor=agent；登录会话 → actor=user。
func (h *IdeaHandler) Share(c *gin.Context) {
	ideaID := c.Param("id")
	idea, err := h.ideaSvc.GetByID(ideaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "idea not found"})
		return
	}
	if idea.Status != model.IdeaStatusActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot share inactive idea"})
		return
	}

	// 解析真实身份：API Key 走 agent；登录用户走 user。
	actorType := "user"
	actorID := extractUserID(c)
	if actorID == "" {
		if agentID, exists := c.Get("agent_id"); exists {
			if id, ok := agentID.(string); ok && id != "" {
				actorType = "agent"
				actorID = id
			}
		}
	}
	if actorID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录或提供 API Key"})
		return
	}

	if err := h.socialSvc.ShareIdea(ideaID, actorType, actorID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "shared"})
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

// GetUserIdeas 返回某用户拥有的所有 idea（跨其拥有的 agent 聚合），供用户主页展示。
// 公开端点，与 GET /agents/:id/ideas 同构。
func (h *IdeaHandler) GetUserIdeas(c *gin.Context) {
	limit := 20
	offset := 0
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = n
		}
	}
	if v := c.Query("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			offset = n
		}
	}

	ideas, total, err := h.ideaSvc.Query(service.QueryFilter{
		OwnerUserID: c.Param("id"),
		Limit:       limit,
		Offset:      offset,
		Sort:        "newest",
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ideas": ideas, "total": total})
}

// React 给 idea 加/切换 emoji 反应（单选语义）。
func (h *IdeaHandler) React(c *gin.Context) {
	ideaID := c.Param("id")
	var input struct {
		Emoji string `json:"emoji" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	userID, agentID := resolveActor(c)
	if userID == "" && agentID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录或提供 API Key"})
		return
	}
	if err := h.socialSvc.ReactToIdea(ideaID, userID, agentID, input.Emoji); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"emoji": input.Emoji})
}

// Unreact 移除当前 actor 对 idea 的反应。
func (h *IdeaHandler) Unreact(c *gin.Context) {
	ideaID := c.Param("id")
	userID, agentID := resolveActor(c)
	if userID == "" && agentID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录或提供 API Key"})
		return
	}
	if err := h.socialSvc.UnreactIdea(ideaID, userID, agentID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "unreacted"})
}

// GetReactions 返回 idea 的各 emoji 计数 + 当前 actor 的选择（若有）。
func (h *IdeaHandler) GetReactions(c *gin.Context) {
	ideaID := c.Param("id")
	counts, err := h.socialSvc.GetReactionCounts(ideaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	userID, agentID := resolveActor(c)
	mine := ""
	if userID != "" || agentID != "" {
		mine, _ = h.socialSvc.GetMyReaction(ideaID, userID, agentID)
	}
	c.JSON(http.StatusOK, gin.H{"counts": counts, "mine": mine})
}
