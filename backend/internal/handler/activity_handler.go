package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service"
)

type ActivityHandler struct {
	db        *gorm.DB
	followSvc *service.FollowService
	socialSvc *service.SocialService
}

func NewActivityHandler(db *gorm.DB, followSvc *service.FollowService, socialSvc *service.SocialService) *ActivityHandler {
	return &ActivityHandler{db: db, followSvc: followSvc, socialSvc: socialSvc}
}

// ActivityView 是 ActivityLog 的丰富化视图，附带关联实体的名称/头像/标题，
// 使前端 feed 无需额外请求即可渲染信息丰富的事件卡片（避免 N+1）。
type ActivityView struct {
	ID         string    `json:"id"`
	ActorType  string    `json:"actor_type"`
	ActorID    string    `json:"actor_id"`
	Action     string    `json:"action"`
	TargetType string    `json:"target_type"`
	TargetID   string    `json:"target_id"`
	Metadata   string    `json:"metadata,omitempty"`
	CreatedAt  time.Time `json:"created_at"`

	ActorName          string         `json:"actor_name,omitempty"`
	ActorAvatar        string         `json:"actor_avatar,omitempty"`
	TargetTitle        string         `json:"target_title,omitempty"`
	TargetDesc         string         `json:"target_desc,omitempty"`
	TargetStatus       string         `json:"target_status,omitempty"`
	TargetCategory     string         `json:"target_category,omitempty"`
	TargetImplStatus   string         `json:"target_impl_status,omitempty"`
	TargetTags         []string       `json:"target_tags,omitempty"`
	TargetIconURL      string         `json:"target_icon_url,omitempty"`
	TargetCoverURL     string         `json:"target_cover_url,omitempty"`
	TargetLikeCount    int            `json:"target_like_count,omitempty"`
	TargetFlowerCount  int            `json:"target_flower_count,omitempty"`
	TargetWishCount    int            `json:"target_wish_count,omitempty"`
	TargetForkCount    int            `json:"target_fork_count,omitempty"`
	TargetCommentCount int            `json:"target_comment_count,omitempty"`
	Reactions          map[string]int `json:"reactions,omitempty"`
}

// hydrateActivities 批量加载 activity 关联的 idea（标题/描述/状态/分类）、
// actor（名字/头像）和 reaction 计数，填充进 ActivityView。批量查询，无 N+1。
func hydrateActivities(db *gorm.DB, socialSvc *service.SocialService, activities []model.ActivityLog) []ActivityView {
	if len(activities) == 0 {
		return []ActivityView{}
	}

	// 收集需要加载的 ID
	ideaIDs := make(map[string]bool)
	actorIDs := make(map[string]bool)
	for _, a := range activities {
		if a.TargetType == "idea" {
			ideaIDs[a.TargetID] = true
		}
		actorIDs[a.ActorID] = true
	}

	// 批量加载 ideas
	type ideaBrief struct {
		ID           string
		Title        string
		Description  string
		Status       string
		ImplStatus   string `gorm:"column:impl_status"`
		Category     string
		Tags         string
		IconURL      string `gorm:"column:icon_url"`
		CoverURL     string `gorm:"column:cover_url"`
		LikeCount    int    `gorm:"column:like_count"`
		FlowerCount  int    `gorm:"column:flower_count"`
		WishCount    int    `gorm:"column:wish_count"`
		ForkCount    int    `gorm:"column:fork_count"`
		CommentCount int    `gorm:"column:comment_count"`
	}
	ideaMap := make(map[string]ideaBrief)
	if len(ideaIDs) > 0 {
		ids := make([]string, 0, len(ideaIDs))
		for id := range ideaIDs {
			ids = append(ids, id)
		}
		var ideas []ideaBrief
		db.Table("ideas").
			Select("id, title, description, status, impl_status, category, tags, icon_url, cover_url, like_count, flower_count, wish_count, fork_count, comment_count").
			Where("id IN ?", ids).
			Scan(&ideas)
		for _, idea := range ideas {
			ideaMap[idea.ID] = idea
		}
	}

	// 批量加载 agents（name + avatar_url）
	type actorBrief struct {
		ID        string
		Name      string
		AvatarURL string
	}
	agentMap := make(map[string]actorBrief)
	userMap := make(map[string]actorBrief)
	if len(actorIDs) > 0 {
		ids := make([]string, 0, len(actorIDs))
		for id := range actorIDs {
			ids = append(ids, id)
		}
		var agents []actorBrief
		db.Table("agents").Select("id, name, avatar_url").Where("id IN ?", ids).Scan(&agents)
		for _, a := range agents {
			agentMap[a.ID] = a
		}
		var users []actorBrief
		db.Table("users").Select("id, name, avatar_url").Where("id IN ?", ids).Scan(&users)
		for _, u := range users {
			userMap[u.ID] = u
		}
	}

	// 批量加载 reaction 计数
	var reactionMap map[string]map[string]int
	if socialSvc != nil && len(ideaIDs) > 0 {
		ids := make([]string, 0, len(ideaIDs))
		for id := range ideaIDs {
			ids = append(ids, id)
		}
		reactionMap, _ = socialSvc.GetBulkReactionCounts(ids)
	}

	// 填充丰富字段
	views := make([]ActivityView, len(activities))
	for i, a := range activities {
		v := ActivityView{
			ID: a.ID, ActorType: a.ActorType, ActorID: a.ActorID,
			Action: a.Action, TargetType: a.TargetType, TargetID: a.TargetID,
			Metadata: a.Metadata, CreatedAt: a.CreatedAt,
		}
		if a.ActorType == "agent" {
			if brief, ok := agentMap[a.ActorID]; ok {
				v.ActorName = brief.Name
				v.ActorAvatar = service.ResolveAgentAvatar(a.ActorID, brief.AvatarURL)
			}
		} else {
			if brief, ok := userMap[a.ActorID]; ok {
				v.ActorName = brief.Name
				v.ActorAvatar = service.ResolveUserAvatar(a.ActorID, brief.AvatarURL)
			}
		}
		if a.TargetType == "idea" {
			if brief, ok := ideaMap[a.TargetID]; ok {
				v.TargetTitle = brief.Title
				v.TargetDesc = brief.Description
				v.TargetStatus = brief.Status
				v.TargetCategory = brief.Category
				v.TargetImplStatus = brief.ImplStatus
				v.TargetIconURL = brief.IconURL
				v.TargetCoverURL = brief.CoverURL
				v.TargetLikeCount = brief.LikeCount
				v.TargetFlowerCount = brief.FlowerCount
				v.TargetWishCount = brief.WishCount
				v.TargetForkCount = brief.ForkCount
				v.TargetCommentCount = brief.CommentCount
				if brief.Tags != "" && brief.Tags != "null" {
					var tags []string
					if err := json.Unmarshal([]byte(brief.Tags), &tags); err == nil {
						v.TargetTags = tags
					}
				}
			}
			if reactionMap != nil {
				if counts, ok := reactionMap[a.TargetID]; ok && len(counts) > 0 {
					v.Reactions = counts
				}
			}
		}
		views[i] = v
	}
	return views
}

func (h *ActivityHandler) List(c *gin.Context) {
	limit, ok := intQuery(c, "limit", 50)
	if !ok {
		return
	}
	offset, ok := intQuery(c, "offset", 0)
	if !ok {
		return
	}

	var activities []model.ActivityLog
	var total int64

	query := h.db.Model(&model.ActivityLog{})
	if actorType := c.Query("actor_type"); actorType != "" {
		query = query.Where("actor_type = ?", actorType)
	}
	if actorID := c.Query("actor_id"); actorID != "" {
		query = query.Where("actor_id = ?", actorID)
	}
	if action := c.Query("action"); action != "" {
		query = query.Where("action = ?", action)
	}
	// 聊天内部事件（建会话/发消息/分叉会话）不进 feed，保持计数与渲染一致
	query = query.Where("action NOT IN ?", heatmapExclude)
	query, ok = applyDateFilter(c, query)
	if !ok {
		return
	}

	query.Count(&total)
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&activities).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"activities": hydrateActivities(h.db, h.socialSvc, activities), "total": total})
}

// applyDateFilter 给动态查询加 ?date=YYYY-MM-DD 按天过滤（热力图点击查看当天 feed 用）。
// 返回 ok=false 表示日期非法已写 400 响应，调用方应直接 return。
func applyDateFilter(c *gin.Context, query *gorm.DB) (*gorm.DB, bool) {
	date := c.Query("date")
	if date == "" {
		return query, true
	}
	if _, err := time.Parse("2006-01-02", date); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date 参数需为 YYYY-MM-DD"})
		return nil, false
	}
	return query.Where("DATE(created_at) = ?", date), true
}

// ListByUser 返回某用户的动态聚合：包含该用户本人 + 其拥有的所有 Agent 的活动。
// activity 表的 actor_id 存的是 agent_id（写操作都走 Agent），所以单按 user_id 查不到
// 其 Agent 产生的动态。这里先查出用户拥有的 agent_id 列表，再用 IN 查询聚合。
//
// GET /users/:id/activity?limit=50&offset=0
func (h *ActivityHandler) ListByUser(c *gin.Context) {
	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing user id"})
		return
	}

	limit, ok := intQuery(c, "limit", 50)
	if !ok {
		return
	}
	offset, ok := intQuery(c, "offset", 0)
	if !ok {
		return
	}

	// 收集 actor_id 候选：用户本人 + 其拥有的 agents。
	var agentIDs []string
	h.db.Model(&model.Agent{}).Where("owner_user_id = ?", userID).Pluck("id", &agentIDs)
	actorIDs := append([]string{userID}, agentIDs...)

	var activities []model.ActivityLog
	var total int64

	query := h.db.Model(&model.ActivityLog{}).Where("actor_id IN ?", actorIDs)
	// 聊天内部事件不进 feed（与热力图口径一致）
	query = query.Where("action NOT IN ?", heatmapExclude)
	query, ok = applyDateFilter(c, query)
	if !ok {
		return
	}
	query.Count(&total)
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&activities).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"activities": hydrateActivities(h.db, h.socialSvc, activities), "total": total})
}

// heatmapDay 热力图的单日计数（GitHub contributions 式）。
type heatmapDay struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

// heatmapExclude 聊天内部事件不计入热力图（与前端 ActivityList 的 hiddenActions
// 对齐，保证方块计数与点击后的当天 feed 行数一致）。
var heatmapExclude = []string{"create_session", "send_message", "fork_session"}

// UserActivityHeatmap GET /users/:id/activity/heatmap
// 近一年该用户（含其拥有的 Agent）的每日活动计数，供 GitHub 式热力图渲染。
func (h *ActivityHandler) UserActivityHeatmap(c *gin.Context) {
	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing user id"})
		return
	}
	var agentIDs []string
	h.db.Model(&model.Agent{}).Where("owner_user_id = ?", userID).Pluck("id", &agentIDs)
	actorIDs := append([]string{userID}, agentIDs...)
	h.respondHeatmap(c, "actor_id IN ?", actorIDs)
}

// AgentActivityHeatmap GET /agents/:id/activity/heatmap
// 近一年该 Agent（作为 actor）的每日活动计数。
func (h *ActivityHandler) AgentActivityHeatmap(c *gin.Context) {
	agentID := c.Param("id")
	if agentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing agent id"})
		return
	}
	h.respondHeatmap(c, "actor_type = ? AND actor_id = ?", "agent", agentID)
}

func (h *ActivityHandler) respondHeatmap(c *gin.Context, cond string, args ...any) {
	since := time.Now().AddDate(-1, 0, 0)
	var days []heatmapDay
	if err := h.db.Model(&model.ActivityLog{}).
		Select("DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS count").
		Where(cond, args...).
		Where("action NOT IN ?", heatmapExclude).
		Where("created_at >= ?", since).
		Group("DATE_FORMAT(created_at, '%Y-%m-%d')").
		Order("date ASC").
		Scan(&days).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var total int64
	for _, d := range days {
		total += d.Count
	}
	c.JSON(http.StatusOK, gin.H{"days": days, "total": total})
}

func (h *ActivityHandler) Stats(c *gin.Context) {
	var stats struct {
		TodayNewIdeas int64 `json:"today_new_ideas"`
		TodayForks    int64 `json:"today_forks"`
		ActiveAgents  int64 `json:"active_agents"`
		TotalActions  int64 `json:"total_actions"`
	}

	h.db.Model(&model.Idea{}).
		Where("created_at >= CURRENT_DATE").
		Count(&stats.TodayNewIdeas)

	h.db.Model(&model.Agent{}).
		Where("created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)").
		Count(&stats.ActiveAgents)

	h.db.Model(&model.ActivityLog{}).
		Where("created_at >= CURRENT_DATE").
		Count(&stats.TotalActions)

	h.db.Model(&model.ActivityLog{}).
		Where("action = ? AND created_at >= CURRENT_DATE", "fork").
		Count(&stats.TodayForks)

	c.JSON(http.StatusOK, stats)
}

type rankingIdea struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	LikeCount   int    `json:"like_count"`
	FlowerCount int    `json:"flower_count"`
	ForkCount   int    `json:"fork_count"`
	WishCount   int    `json:"wish_count"`
	Category    string `json:"category"`
	IconURL     string `json:"icon_url"`
	CoverURL    string `json:"cover_url"`
}

// Feed aggregates activity page data in one response (avoids 6 parallel SSR fetches).
func (h *ActivityHandler) Feed(c *gin.Context) {
	limit, ok := intQuery(c, "limit", 30)
	if !ok {
		return
	}
	if limit <= 0 || limit > 50 {
		limit = 30
	}

	var stats struct {
		TodayNewIdeas int64 `json:"today_new_ideas"`
		TodayForks    int64 `json:"today_forks"`
		ActiveAgents  int64 `json:"active_agents"`
		TotalActions  int64 `json:"total_actions"`
	}
	var activities []model.ActivityLog
	var activityTotal int64
	var totalIdeas int64
	var popular, flowers, forks []rankingIdea

	rankingCols := "id, title, like_count, flower_count, fork_count, wish_count, category, icon_url, cover_url"

	h.db.Model(&model.Idea{}).Where("created_at >= CURRENT_DATE").Count(&stats.TodayNewIdeas)
	h.db.Model(&model.Agent{}).Where("created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)").Count(&stats.ActiveAgents)
	h.db.Model(&model.ActivityLog{}).Where("created_at >= CURRENT_DATE").Count(&stats.TotalActions)
	h.db.Model(&model.ActivityLog{}).Where("action = ? AND created_at >= CURRENT_DATE", "fork").Count(&stats.TodayForks)

	h.db.Model(&model.ActivityLog{}).Where("action IN ?", service.FeedActions).Count(&activityTotal)
	h.db.Model(&model.ActivityLog{}).
		Where("action IN ?", service.FeedActions).
		Order("created_at DESC").Limit(limit).Find(&activities)

	h.db.Model(&model.Idea{}).Count(&totalIdeas)

	h.db.Model(&model.Idea{}).Select(rankingCols).
		Order("like_count DESC, created_at DESC").Limit(5).Find(&popular)
	h.db.Model(&model.Idea{}).Select(rankingCols).
		Order("wish_count DESC, created_at DESC").Limit(5).Find(&flowers)
	h.db.Model(&model.Idea{}).Select(rankingCols).
		Order("fork_count DESC, created_at DESC").Limit(5).Find(&forks)

	c.JSON(http.StatusOK, gin.H{
		"stats":       stats,
		"activities":  hydrateActivities(h.db, h.socialSvc, activities),
		"total":       activityTotal,
		"total_ideas": totalIdeas,
		"rankings": gin.H{
			"popular": popular,
			"flowers": flowers,
			"forks":   forks,
		},
	})
}

// FollowingFeed 返回当前登录用户关注的主体（agent + user）的活动流，
// 同样只含白名单动作（create/fork/share）。需 UserAuth（由路由保证）。
func (h *ActivityHandler) FollowingFeed(c *gin.Context) {
	userID := extractUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "login required"})
		return
	}

	limit, ok := intQuery(c, "limit", 30)
	if !ok {
		return
	}
	if limit <= 0 || limit > 50 {
		limit = 30
	}
	offset, ok := intQuery(c, "offset", 0)
	if !ok {
		return
	}

	actors, err := h.followSvc.FollowedActors(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 没有关注任何人 → 空流（而非 500）。
	if len(actors) == 0 {
		c.JSON(http.StatusOK, gin.H{"activities": []ActivityView{}, "total": 0})
		return
	}

	// 构造 (actor_type = ? AND actor_id = ?) OR ... 过滤。
	// GORM 不支持结构体元组的复合 IN，所以用 OR 子句拼接 + 参数化绑定。
	actorConds := make([]string, 0, len(actors))
	actorArgs := make([]any, 0, len(actors)*2)
	for _, a := range actors {
		actorConds = append(actorConds, "(actor_type = ? AND actor_id = ?)")
		actorArgs = append(actorArgs, a.Type, a.ID)
	}
	actorFilter := h.db.Model(&model.ActivityLog{}).Where(
		"("+joinOr(actorConds)+")", actorArgs...,
	)

	query := actorFilter.Where("action IN ?", service.FeedActions)

	var total int64
	query.Count(&total)

	var activities []model.ActivityLog
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&activities).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"activities": hydrateActivities(h.db, h.socialSvc, activities), "total": total})
}
