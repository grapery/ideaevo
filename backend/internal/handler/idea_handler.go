package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

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

// resolveAuthorAgentID 确定写操作的 Agent 作者 ID。
// API Key 认证 → 当前 Agent；JWT 用户 → 自动绑定/创建默认个人 Agent（与聊天 buildPrincipal 一致）。
func (h *IdeaHandler) resolveAuthorAgentID(c *gin.Context) (string, error) {
	if agentID := c.GetString("agent_id"); agentID != "" {
		return agentID, nil
	}
	userID := extractUserID(c)
	if userID == "" {
		return "", fmt.Errorf("请先登录或提供 API Key")
	}
	agent, err := h.agentSvc.EnsureDefaultUserAgent(userID)
	if err != nil {
		return "", fmt.Errorf("无法解析用户 Agent: %w", err)
	}
	return agent.ID, nil
}

// resolvePublishAgentID 确定发布想法时的 Agent 作者 ID。
// API Key → 当前 Agent；JWT 用户 → 可选 agent_id（须为本人拥有），否则默认个人 Agent。
func (h *IdeaHandler) resolvePublishAgentID(c *gin.Context, requestedAgentID string) (string, error) {
	if agentID := c.GetString("agent_id"); agentID != "" {
		return agentID, nil
	}
	userID := extractUserID(c)
	if userID == "" {
		return "", fmt.Errorf("请先登录或提供 API Key")
	}
	if requestedAgentID != "" {
		agent, err := h.agentSvc.GetByID(requestedAgentID)
		if err != nil {
			return "", fmt.Errorf("Agent 不存在")
		}
		if agent.OwnerUserID != userID {
			return "", fmt.Errorf("无权使用该 Agent 发布")
		}
		return agent.ID, nil
	}
	return h.resolveAuthorAgentID(c)
}

func (h *IdeaHandler) GetByID(c *gin.Context) {
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	ideas := []model.Idea{*idea}
	h.agentSvc.AttachOwnersToIdeas(ideas)
	c.JSON(http.StatusOK, ideas[0])
}

func (h *IdeaHandler) Query(c *gin.Context) {
	var filter service.QueryFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	ideas, total, err := h.ideaSvc.Query(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	h.agentSvc.AttachOwnersToIdeas(ideas)

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

	status := c.Query("status")
	if status == "" {
		status = "active"
	}
	if status != "" && !validStatuses[status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyMessage("invalid status filter")})
		return
	}

	opts := service.SearchOptions{
		Threshold: threshold,
		Limit:     limit,
		Offset:    offset,
		Status:    status,
	}

	results, err := h.ideaSvc.Search(query, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	for i := range results {
		service.EnrichIdea(&results[i].Idea)
	}

	c.JSON(http.StatusOK, gin.H{
		"results": results,
		"page":    page,
		"limit":   limit,
		"offset":  offset,
	})
}

func (h *IdeaHandler) Bury(c *gin.Context) {
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if !h.canManageIdea(c, idea) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的创建者才能埋葬"})
		return
	}

	var input struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	idea, err = h.ideaSvc.Bury(idea.ID, idea.AgentID, input.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, idea)
}

// Create 注册新想法（JWT 用户或 Agent API Key）。
func (h *IdeaHandler) Create(c *gin.Context) {
	var input struct {
		Title       string   `json:"title" binding:"required"`
		Description string   `json:"description" binding:"required"`
		Category    string   `json:"category"`
		Tags        []string `json:"tags"`
		RepoURL     string   `json:"repo_url"`
		DemoURL     string   `json:"demo_url"`
		AgentID     string   `json:"agent_id"`
		Force       bool     `json:"force"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	category := input.Category
	if category == "" {
		category = "other"
	}

	agentID, err := h.resolvePublishAgentID(c, input.AgentID)
	if err != nil {
		status := http.StatusUnauthorized
		if strings.Contains(err.Error(), "无权") || strings.Contains(err.Error(), "不存在") {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": FriendlyBindError(err)})
		return
	}

	ownerUserID := extractUserID(c)
	if ownerUserID != "" && !input.Force {
		similar, simErr := h.ideaSvc.FindSimilarForRegister(ownerUserID, input.Title, input.Description)
		if simErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(simErr)})
			return
		}
		if len(similar) > 0 && service.MaxIdeaMatchSimilarity(similar) >= 0.80 {
			c.JSON(http.StatusConflict, gin.H{
				"error":         "与已有 idea 高度相似，建议扩展现有 idea 或调整标题/描述后再发布",
				"similar_ideas": similar,
			})
			return
		}
	}

	idea, err := h.ideaSvc.Register(agentID, service.RegisterIdeaInput{
		Title:       input.Title,
		Description: input.Description,
		Category:    category,
		Tags:        input.Tags,
		RepoURL:     input.RepoURL,
		DemoURL:     input.DemoURL,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusCreated, idea)
}

func (h *IdeaHandler) UpdateStatus(c *gin.Context) {
	agentID := c.GetString("agent_id")
	var input struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	if !validStatuses[input.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "状态取值无效，可选: active, buried, archived, implemented"})
		return
	}

	// 权限校验：只有 idea 的创建者 Agent 才能修改状态
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if idea.AgentID != agentID {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的创建者才能修改状态"})
		return
	}

	idea, err = h.ideaSvc.UpdateStatus(c.Param("id"), input.Status)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, idea)
}

// UpdateMeta 更新想法可选附加信息（实现状态、仓库、演示、图标），仅创建者可操作。
func (h *IdeaHandler) UpdateMeta(c *gin.Context) {
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if !h.canManageIdea(c, idea) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的创建者才能更新附加信息"})
		return
	}

	var input service.UpdateIdeaMetaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	idea, err = h.ideaSvc.UpdateMeta(idea.ID, input, h.assets)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, idea)
}

// ResetIcon restores the idea icon to the default DiceBear image (creator only).
func (h *IdeaHandler) ResetIcon(c *gin.Context) {
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if !h.canManageIdea(c, idea) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的创建者才能重置图标"})
		return
	}
	idea, err = h.ideaSvc.ResetIcon(idea.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, idea)
}

// PresignUpload 为想法资源（图标 / 描述插图）预签名 OSS 上传地址（仅创建者可用）。
func (h *IdeaHandler) PresignUpload(c *gin.Context) {
	if h.assets == nil || !h.assets.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "上传未配置"})
		return
	}

	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if !h.canManageIdea(c, idea) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的创建者才能上传资源"})
		return
	}

	var input struct {
		ContentType string `json:"content_type" binding:"required"`
		Kind        string `json:"kind"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	kind := input.Kind
	if kind == "" {
		kind = "icon"
	}
	if kind != "icon" && kind != "content" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "上传类型无效，必须为 icon 或 content"})
		return
	}

	result, err := h.assets.PresignPut("ideas", idea.ID, kind, input.ContentType)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, result)
}

// PresignIcon 兼容旧客户端，等同于 kind=icon。
func (h *IdeaHandler) PresignIcon(c *gin.Context) {
	h.PresignUpload(c)
}

func (h *IdeaHandler) GetVersions(c *gin.Context) {
	versions, err := h.ideaSvc.ListVersions(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"versions": versions})
}

// GetStats returns the counters used by the Idea detail overview and version timeline.
func (h *IdeaHandler) GetStats(c *gin.Context) {
	stats, err := h.ideaSvc.Stats(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// GetLineage returns version-aware provenance for one Idea in a single contract.
func (h *IdeaHandler) GetLineage(c *gin.Context) {
	lineage, err := h.socialSvc.GetIdeaLineage(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	ideas := []model.Idea{lineage.Idea}
	if lineage.SourceIdea != nil {
		ideas = append(ideas, *lineage.SourceIdea)
	}
	ideas = append(ideas, lineage.Children...)
	h.agentSvc.AttachOwnersToIdeas(ideas)

	lineage.Idea = ideas[0]
	idx := 1
	if lineage.SourceIdea != nil {
		lineage.SourceIdea = &ideas[idx]
		idx++
	}
	if len(lineage.Children) > 0 {
		lineage.Children = ideas[idx:]
	}
	c.JSON(http.StatusOK, lineage)
}

func (h *IdeaHandler) GetBookmarkStatus(c *gin.Context) {
	userID := extractUserID(c)
	if userID == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "收藏仅支持用户账户"})
		return
	}
	bookmarked, err := h.ideaSvc.IsBookmarked(c.Param("id"), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"bookmarked": bookmarked})
}

func (h *IdeaHandler) Bookmark(c *gin.Context) {
	userID := extractUserID(c)
	if userID == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "收藏仅支持用户账户"})
		return
	}
	if err := h.ideaSvc.Bookmark(c.Param("id"), userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "bookmarked"})
}

func (h *IdeaHandler) Unbookmark(c *gin.Context) {
	userID := extractUserID(c)
	if userID == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "收藏仅支持用户账户"})
		return
	}
	if err := h.ideaSvc.Unbookmark(c.Param("id"), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "unbookmarked"})
}

func (h *IdeaHandler) RecordView(c *gin.Context) {
	h.recordMetric(c, "view")
}

func (h *IdeaHandler) RecordReference(c *gin.Context) {
	h.recordMetric(c, "reference")
}

func (h *IdeaHandler) recordMetric(c *gin.Context, kind string) {
	if err := h.ideaSvc.RecordMetric(c.Param("id"), kind); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

func (h *IdeaHandler) GetVersion(c *gin.Context) {
	v, err := h.ideaSvc.GetVersion(c.Param("id"), c.Param("versionId"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "版本不存在"})
		return
	}
	c.JSON(http.StatusOK, v)
}

// PublishVersion advances an Idea through one complete, atomic content revision.
func (h *IdeaHandler) PublishVersion(c *gin.Context) {
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if !h.canManageIdea(c, idea) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法所属 Agent 的所有者才能发布新版本"})
		return
	}

	var input service.PublishIdeaVersionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	idea, err = h.ideaSvc.PublishVersion(idea.ID, input, h.assets)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusCreated, idea)
}

func (h *IdeaHandler) UpdateDescription(c *gin.Context) {
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if !h.canManageIdea(c, idea) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的创建者才能编辑描述"})
		return
	}

	var input service.UpdateDescriptionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	idea, err = h.ideaSvc.UpdateDescription(idea.ID, input, h.assets)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, idea)
}

func (h *IdeaHandler) Like(c *gin.Context) {
	ideaID := c.Param("id")
	if _, err := h.ideaSvc.GetByID(ideaID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}

	agentIDStr := c.GetString("agent_id")
	userID := extractUserID(c)
	if userID == "" && agentIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录或提供 API Key"})
		return
	}

	if err := h.socialSvc.LikeIdea(ideaID, userID, agentIDStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "liked"})
}

func (h *IdeaHandler) GetLikeStatus(c *gin.Context) {
	ideaID := c.Param("id")
	if _, err := h.ideaSvc.GetByID(ideaID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
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
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
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
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if idea.Status != model.IdeaStatusActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无法给非活跃的想法送花"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "flowers sent"})
}

func (h *IdeaHandler) Fork(c *gin.Context) {
	ideaID := c.Param("id")
	idea, err := h.ideaSvc.GetByID(ideaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if idea.Status != model.IdeaStatusActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无法 fork 非活跃的想法"})
		return
	}

	var input struct {
		Title           string `json:"title" binding:"required"`
		Description     string `json:"description" binding:"required"`
		Reason          string `json:"reason" binding:"required"`
		Category        string `json:"category"`
		SourceVersionID string `json:"source_version_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	agentIDStr, err := h.resolveAuthorAgentID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": FriendlyBindError(err)})
		return
	}

	newIdea, err := h.socialSvc.ForkIdea(service.ForkIdeaInput{
		IdeaID:          ideaID,
		SourceVersionID: input.SourceVersionID,
		AgentID:         agentIDStr,
		Title:           input.Title,
		Description:     input.Description,
		Reason:          input.Reason,
		Category:        input.Category,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
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
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "shared"})
}

func (h *IdeaHandler) GetComments(c *gin.Context) {
	comments, err := h.wanyeSvc.GetCommentsEnriched(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, comments)
}

func (h *IdeaHandler) CreateComment(c *gin.Context) {
	ideaID := c.Param("id")
	idea, err := h.ideaSvc.GetByID(ideaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if idea.Status != model.IdeaStatusActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot comment on inactive idea"})
		return
	}

	var input service.CreateCommentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusCreated, comment)
}

func (h *IdeaHandler) GetForks(c *gin.Context) {
	forks, err := h.socialSvc.GetForks(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, forks)
}

func (h *IdeaHandler) GetForkChildren(c *gin.Context) {
	ideas, err := h.socialSvc.GetPublicForkChildren(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	if ideas == nil {
		ideas = []model.Idea{}
	}
	h.agentSvc.AttachOwnersToIdeas(ideas)
	c.JSON(http.StatusOK, gin.H{"ideas": ideas})
}

func (h *IdeaHandler) GetFlowers(c *gin.Context) {
	donors, err := h.socialSvc.GetFlowerDonors(c.Param("id"), 20)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	if donors == nil {
		donors = []service.FlowerDonorView{}
	}
	c.JSON(http.StatusOK, gin.H{"donors": donors})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	h.agentSvc.AttachOwnersToIdeas(ideas)
	c.JSON(http.StatusOK, gin.H{"ideas": ideas, "total": total})
}

// React 给 idea 加/切换 emoji 反应（单选语义）。
func (h *IdeaHandler) React(c *gin.Context) {
	ideaID := c.Param("id")
	var input struct {
		Emoji string `json:"emoji" binding:"required"`
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
	if err := h.socialSvc.ReactToIdea(ideaID, userID, agentID, input.Emoji); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "unreacted"})
}

// GetReactions 返回 idea 的各 emoji 计数 + 当前 actor 的选择（若有）。
func (h *IdeaHandler) GetReactions(c *gin.Context) {
	ideaID := c.Param("id")
	counts, err := h.socialSvc.GetReactionCounts(ideaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	userID, agentID := resolveActor(c)
	mine := ""
	if userID != "" || agentID != "" {
		mine, _ = h.socialSvc.GetMyReaction(ideaID, userID, agentID)
	}
	c.JSON(http.StatusOK, gin.H{"counts": counts, "mine": mine})
}
