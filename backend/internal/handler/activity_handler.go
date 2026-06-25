package handler

import (
	"fmt"
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
}

func NewActivityHandler(db *gorm.DB, followSvc *service.FollowService) *ActivityHandler {
	return &ActivityHandler{db: db, followSvc: followSvc}
}

// ActivityView 是 ActivityLog 的丰富化视图，附带关联实体的名称/头像/标题，
// 使前端 feed 无需额外请求即可渲染 GitHub 式事件卡片（避免 N+1）。
type ActivityView struct {
	ID         string    `json:"id"`
	ActorType  string    `json:"actor_type"`
	ActorID    string    `json:"actor_id"`
	Action     string    `json:"action"`
	TargetType string    `json:"target_type"`
	TargetID   string    `json:"target_id"`
	Metadata   string    `json:"metadata,omitempty"`
	CreatedAt  time.Time `json:"created_at"`

	ActorName      string `json:"actor_name,omitempty"`
	ActorAvatar    string `json:"actor_avatar,omitempty"`
	TargetTitle    string `json:"target_title,omitempty"`
	TargetDesc     string `json:"target_desc,omitempty"`
	TargetStatus   string `json:"target_status,omitempty"`
	TargetCategory string `json:"target_category,omitempty"`
}

// hydrateActivities 批量加载 activity 关联的 idea（标题/描述/状态/分类）和
// actor（名字/头像），填充进 ActivityView。3 次批量查询，无 N+1。
func hydrateActivities(db *gorm.DB, activities []model.ActivityLog) []ActivityView {
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
		ID          string
		Title       string
		Description string
		Status      string
		Category    string
	}
	ideaMap := make(map[string]ideaBrief)
	if len(ideaIDs) > 0 {
		ids := make([]string, 0, len(ideaIDs))
		for id := range ideaIDs {
			ids = append(ids, id)
		}
		var ideas []ideaBrief
		db.Table("ideas").Select("id, title, description, status, category").Where("id IN ?", ids).Scan(&ideas)
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
				v.ActorAvatar = brief.AvatarURL
			}
		} else {
			if brief, ok := userMap[a.ActorID]; ok {
				v.ActorName = brief.Name
				v.ActorAvatar = brief.AvatarURL
			}
		}
		if a.TargetType == "idea" {
			if brief, ok := ideaMap[a.TargetID]; ok {
				v.TargetTitle = brief.Title
				v.TargetDesc = brief.Description
				v.TargetStatus = brief.Status
				v.TargetCategory = brief.Category
			}
		}
		views[i] = v
	}
	return views
}

func (h *ActivityHandler) List(c *gin.Context) {
	limit := 50
	offset := 0
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}
	if v := c.Query("offset"); v != "" {
		fmt.Sscanf(v, "%d", &offset)
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

	query.Count(&total)
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&activities).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"activities": hydrateActivities(h.db, activities), "total": total})
}

func (h *ActivityHandler) Stats(c *gin.Context) {
	var stats struct {
		TodayNewIdeas int64 `json:"today_new_ideas"`
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

	c.JSON(http.StatusOK, stats)
}

type rankingIdea struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	LikeCount   int    `json:"like_count"`
	FlowerCount int    `json:"flower_count"`
	ForkCount   int    `json:"fork_count"`
	Category    string `json:"category"`
}

// Feed aggregates activity page data in one response (avoids 6 parallel SSR fetches).
func (h *ActivityHandler) Feed(c *gin.Context) {
	limit := 30
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}
	if limit <= 0 || limit > 50 {
		limit = 30
	}

	var stats struct {
		TodayNewIdeas int64 `json:"today_new_ideas"`
		ActiveAgents  int64 `json:"active_agents"`
		TotalActions  int64 `json:"total_actions"`
	}
	var activities []model.ActivityLog
	var activityTotal int64
	var totalIdeas int64
	var popular, flowers, forks []rankingIdea

	rankingCols := "id, title, like_count, flower_count, fork_count, category"

	h.db.Model(&model.Idea{}).Where("created_at >= CURRENT_DATE").Count(&stats.TodayNewIdeas)
	h.db.Model(&model.Agent{}).Where("created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)").Count(&stats.ActiveAgents)
	h.db.Model(&model.ActivityLog{}).Where("created_at >= CURRENT_DATE").Count(&stats.TotalActions)

	h.db.Model(&model.ActivityLog{}).Where("action IN ?", service.FeedActions).Count(&activityTotal)
	h.db.Model(&model.ActivityLog{}).
		Where("action IN ?", service.FeedActions).
		Order("created_at DESC").Limit(limit).Find(&activities)

	h.db.Model(&model.Idea{}).Count(&totalIdeas)

	h.db.Model(&model.Idea{}).Select(rankingCols).
		Order("like_count DESC, created_at DESC").Limit(5).Find(&popular)
	h.db.Model(&model.Idea{}).Select(rankingCols).
		Order("flower_count DESC, created_at DESC").Limit(5).Find(&flowers)
	h.db.Model(&model.Idea{}).Select(rankingCols).
		Order("fork_count DESC, created_at DESC").Limit(5).Find(&forks)

	c.JSON(http.StatusOK, gin.H{
		"stats":       stats,
		"activities":  hydrateActivities(h.db, activities),
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

	limit := 30
	if v := c.Query("limit"); v != "" {
		fmt.Sscanf(v, "%d", &limit)
	}
	if limit <= 0 || limit > 50 {
		limit = 30
	}
	offset := 0
	if v := c.Query("offset"); v != "" {
		fmt.Sscanf(v, "%d", &offset)
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

	c.JSON(http.StatusOK, gin.H{"activities": hydrateActivities(h.db, activities), "total": total})
}
