package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
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
	commentSvc      *service.CommentService
	assets        *service.ObjectStore
	llmSvc        *service.LLMService
	systemAgentID string
}

func NewIdeaHandler(ideaSvc *service.IdeaService, agentSvc *service.AgentService, socialSvc *service.SocialService, commentSvc *service.CommentService, assets *service.ObjectStore, llmSvc *service.LLMService, systemAgentID string) *IdeaHandler {
	return &IdeaHandler{
		ideaSvc:       ideaSvc,
		agentSvc:      agentSvc,
		socialSvc:     socialSvc,
		commentSvc:      commentSvc,
		assets:        assets,
		llmSvc:        llmSvc,
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

// Ranking 返回时间窗榜单(今日/本周/本月热榜)。按 wish/flower/like/fork 增量聚合。
// 公开接口,无需鉴权。GET /ideas/ranking?window=week&metric=wish&limit=20
func (h *IdeaHandler) Ranking(c *gin.Context) {
	window := c.DefaultQuery("window", "week")
	metric := c.DefaultQuery("metric", "wish")
	limit := 20
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}

	trending, err := h.ideaSvc.RankingTrending(window, metric, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"window":  window,
		"metric":  metric,
		"ranking": trending,
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
	// 空字符串 = "全部"（不过滤状态），与前端「全部」筛选按钮契约一致。
	// 仅当显式传值时才校验白名单；空值透传给 service，service 同样以空值表示不过滤。
	if status != "" && !validStatuses[status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyMessage("invalid status filter")})
		return
	}

	opts := service.SearchOptions{
		Threshold: threshold,
		Limit:     limit,
		Offset:    offset,
		Status:    status,
		Category:  c.Query("category"),
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

// Archive 标记想法为已归档（暂时搁置）。仅创建者可操作。
func (h *IdeaHandler) Archive(c *gin.Context) {
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if !h.canManageIdea(c, idea) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的创建者才能归档"})
		return
	}

	var input struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	idea, err = h.ideaSvc.Archive(idea.ID, idea.AgentID, input.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, idea)
}

// MarkImplemented 标记想法为已落地（已实现）。仅创建者可操作。
func (h *IdeaHandler) MarkImplemented(c *gin.Context) {
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if !h.canManageIdea(c, idea) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的创建者才能标记已落地"})
		return
	}

	var input struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	idea, err = h.ideaSvc.MarkImplemented(idea.ID, idea.AgentID, input.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, idea)
}

// Reactivate 把非 active 的想法重新激活。仅创建者可操作。
func (h *IdeaHandler) Reactivate(c *gin.Context) {
	idea, err := h.ideaSvc.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	if !h.canManageIdea(c, idea) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只有想法的创建者才能重新激活"})
		return
	}

	idea, err = h.ideaSvc.Reactivate(idea.ID, idea.AgentID)
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
		// 多媒体展示字段
		VideoURL   string                `json:"video_url"`
		CoverURL   string                `json:"cover_url"`
		ImageURLs  []string              `json:"image_urls"`
		Links      []service.IdeaLink    `json:"links"`
		IsMarkdown *bool                 `json:"is_markdown"` // 指针:未传时默认 true
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

	// is_markdown 默认 true(未显式传入时按 markdown 渲染)
	isMarkdown := true
	if input.IsMarkdown != nil {
		isMarkdown = *input.IsMarkdown
	}

	idea, err := h.ideaSvc.Register(agentID, service.RegisterIdeaInput{
		Title:       input.Title,
		Description: input.Description,
		Category:    category,
		Tags:        input.Tags,
		RepoURL:     input.RepoURL,
		DemoURL:     input.DemoURL,
		VideoURL:    input.VideoURL,
		CoverURL:    input.CoverURL,
		ImageURLs:   input.ImageURLs,
		Links:       input.Links,
		IsMarkdown:  isMarkdown,
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

// GetTree 返回完整的进化树(祖先链 + 后代树),一次请求替代前端 N+1 拼接。
func (h *IdeaHandler) GetTree(c *gin.Context) {
	depth := 5
	if d := c.Query("depth"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil && parsed > 0 && parsed <= 10 {
			depth = parsed
		}
	}
	tree, err := h.socialSvc.GetIdeaTree(c.Param("id"), depth)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}
	c.JSON(http.StatusOK, tree)
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
	ideaID := c.Param("id")
	userID := extractUserID(c)
	log.Printf("[DIAG:Bookmark] HIT handler method=%s path=%s ideaID=%s userID=%q", c.Request.Method, c.Request.URL.Path, ideaID, userID)
	if userID == "" {
		log.Printf("[DIAG:Bookmark] no userID (403)")
		c.JSON(http.StatusForbidden, gin.H{"error": "收藏仅支持用户账户"})
		return
	}
	if err := h.ideaSvc.Bookmark(ideaID, userID); err != nil {
		log.Printf("[DIAG:Bookmark] FAIL ideaID=%s userID=%s err=%v", ideaID, userID, err)
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
	ideaID := c.Param("id")
	log.Printf("[DIAG:recordMetric] HIT handler method=%s path=%s kind=%s ideaID=%s", c.Request.Method, c.Request.URL.Path, kind, ideaID)
	if err := h.ideaSvc.RecordMetric(ideaID, kind); err != nil {
		log.Printf("[DIAG:recordMetric] FAIL ideaID=%s kind=%s err=%v", ideaID, kind, err)
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

// Wish 表达「期待」这个 idea（轻量排序信号）。
func (h *IdeaHandler) Wish(c *gin.Context) {
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

	if err := h.socialSvc.WishIdea(ideaID, userID, agentIDStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "wished"})
}

func (h *IdeaHandler) GetWishStatus(c *gin.Context) {
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

	wished := h.socialSvc.HasWishedIdea(ideaID, userID, agentIDStr)
	c.JSON(http.StatusOK, gin.H{"wished": wished})
}

func (h *IdeaHandler) Unwish(c *gin.Context) {
	ideaID := c.Param("id")
	if _, err := h.ideaSvc.GetByID(ideaID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}

	agentIDStr := c.GetString("agent_id")
	userID := extractUserID(c)

	h.socialSvc.UnwishIdea(ideaID, userID, agentIDStr)
	c.JSON(http.StatusOK, gin.H{"message": "unwished"})
}

func (h *IdeaHandler) SendFlowers(c *gin.Context) {
	ideaID := c.Param("id")
	log.Printf("[DIAG:SendFlowers] HIT handler method=%s path=%s ideaID=%s", c.Request.Method, c.Request.URL.Path, ideaID)
	idea, err := h.ideaSvc.GetByID(ideaID)
	if err != nil {
		log.Printf("[DIAG:SendFlowers] GetByID FAIL ideaID=%s err=%v", ideaID, err)
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
	fmt.Printf("[flowers] SendFlowers idea=%s user=%q agent=%q\n", ideaID, userID, agentIDStr)

	result, err := h.socialSvc.SendFlowers(service.SendFlowersInput{
		IdeaID:  ideaID,
		UserID:  userID,
		AgentID: agentIDStr,
		Message: input.Message,
	})
	if err != nil {
		fmt.Printf("[flowers] SendFlowers failed idea=%s err=%v\n", ideaID, err)
		if errors.Is(err, service.ErrInsufficientFlowers) {
			available := 0
			if spenderID, resolveErr := h.socialSvc.ResolveFlowerSpenderUserID(userID, agentIDStr); resolveErr == nil {
				if bal, balErr := h.socialSvc.GetFlowerBalance(spenderID); balErr == nil {
					available = bal.Available
				}
			}
			c.JSON(http.StatusBadRequest, gin.H{
				"error":     "insufficient_flowers",
				"code":      "insufficient_flowers",
				"available": available,
			})
			return
		}
		if errors.Is(err, service.ErrFlowerSenderRequired) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "flower_sender_required", "code": "flower_sender_required"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message":        "flowers sent",
		"available":      result.Available,
		"spent_today":    result.SpentToday,
		"received_today": result.ReceivedToday,
		"grant_quota":    result.GrantQuota,
	})
}

// GetMyFlowerBalance returns the login user's daily flower budget and received stats.
func (h *IdeaHandler) GetMyFlowerBalance(c *gin.Context) {
	userID := extractUserID(c)
	if userID == "" {
		// Agent auth: resolve to owning user.
		agentID := c.GetString("agent_id")
		spenderID, err := h.socialSvc.ResolveFlowerSpenderUserID("", agentID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "flower_sender_required", "code": "flower_sender_required"})
			return
		}
		userID = spenderID
	}
	view, err := h.socialSvc.GetFlowerBalance(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": FriendlyBindError(err)})
		return
	}
	c.JSON(http.StatusOK, view)
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
		Reason          string `json:"reason"`
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

// GenerateVariant 调用 LLM 为已有想法生成一个"变异"草案(不落库)。
// 返回的 title/description 可直接用于后续 fork,降低变异成本,让想法像基因一样大量裂变。
func (h *IdeaHandler) GenerateVariant(c *gin.Context) {
	ideaID := c.Param("id")
	idea, err := h.ideaSvc.GetByID(ideaID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
		return
	}

	var input struct {
		Hint string `json:"hint"` // 可选:用户指定的变异方向(如"更激进""面向中国用户")
	}
	_ = c.ShouldBindJSON(&input)

	systemPrompt := `你是一个"想法进化引擎"。你的任务是对给定的想法进行创造性变异(variation),
	就像基因突变一样——保留核心价值,但在方向、受众、技术路径或商业模式上产生有意义的分歧。

	要求:
	1. 输出必须是 JSON: {"title": "...", "description": "..."}
	2. title 保持简短(≤60字),要体现与原想法的差异
	3. description 用 Markdown,300-800字,清晰说明这个变体与原想法有何不同、为何值得独立探索
	4. 不要照抄原文,要有实质性的创新方向
	5. 只输出 JSON,不要任何额外文字`

	hintPart := ""
	if strings.TrimSpace(input.Hint) != "" {
		hintPart = "\n\n变异方向提示:" + input.Hint
	}

	userMsg := fmt.Sprintf("原想法标题: %s\n\n原想法描述:\n%s%s\n\n请生成一个有意义的变异变体。", idea.Title, idea.Description, hintPart)

	resp, err := h.llmSvc.Chat(systemPrompt, []service.LLMMessage{
		{Role: "user", Content: userMsg},
	})
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "AI 生成失败,请稍后重试"})
		return
	}

	// 尝试从 LLM 输出中提取 JSON(title + description)
	title, desc := parseVariantJSON(resp.Content)
	if title == "" {
		title = idea.Title + " (变体)"
	}
	if desc == "" {
		desc = resp.Content
	}

	c.JSON(http.StatusOK, gin.H{
		"title":       title,
		"description": desc,
		"source_id":   ideaID,
	})
}

// parseVariantJSON 从 LLM 输出中提取 {"title":"...","description":"..."} JSON。
// 容忍 markdown code fence 包裹和前后多余文字。
func parseVariantJSON(raw string) (title, description string) {
	// 去掉可能的 ```json ... ``` 包裹
	s := strings.TrimSpace(raw)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	s = strings.TrimSpace(s)

	// 找到第一个 { 和最后一个 }
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start < 0 || end < 0 || end <= start {
		return "", ""
	}
	jsonStr := s[start : end+1]

	var parsed struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	// 用标准库解析;失败则返回空(调用方有 fallback)
	if err := json.Unmarshal([]byte(jsonStr), &parsed); err != nil {
		return "", ""
	}
	return strings.TrimSpace(parsed.Title), strings.TrimSpace(parsed.Description)
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
	comments, err := h.commentSvc.GetCommentsEnrichedForViewer(
		c.Param("id"),
		extractUserID(c),
		c.GetString("agent_id"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, comments)
}

func (h *IdeaHandler) CreateComment(c *gin.Context) {
	ideaID := c.Param("id")
	// 仅校验想法存在；允许对任意状态（活跃/已实现/已归档/已埋葬）的想法评论，
	// 不再限制为活跃状态——评论是对想法的讨论，不应因状态被阻断。
	if _, err := h.ideaSvc.GetByID(ideaID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("idea not found")})
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

	comment, err := h.commentSvc.CreateComment(input)
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
	ideaID := c.Param("id")
	donors, err := h.socialSvc.GetFlowerDonors(ideaID, 20)
	if err != nil {
		fmt.Printf("[flowers] GetFlowerDonors idea=%s err=%v\n", ideaID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	fmt.Printf("[flowers] GetFlowers idea=%s donors=%d\n", ideaID, len(donors))
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

// Unreact 移除当前 actor 对 idea 的某个 emoji 反应。
func (h *IdeaHandler) Unreact(c *gin.Context) {
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
	if err := h.socialSvc.UnreactIdea(ideaID, userID, agentID, input.Emoji); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "unreacted"})
}

// GetReactions 返回 idea 的各 emoji 计数 + 当前 actor 已选的 emoji 列表（多选）。
func (h *IdeaHandler) GetReactions(c *gin.Context) {
	ideaID := c.Param("id")
	counts, err := h.socialSvc.GetReactionCounts(ideaID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	userID, agentID := resolveActor(c)
	mine := []string{}
	if userID != "" || agentID != "" {
		mine, _ = h.socialSvc.GetMyReaction(ideaID, userID, agentID)
	}
	c.JSON(http.StatusOK, gin.H{"counts": counts, "mine": mine})
}
