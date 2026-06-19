package handler

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/wanye/ideaevo/internal/model"
)

type ActivityHandler struct {
	db *gorm.DB
}

func NewActivityHandler(db *gorm.DB) *ActivityHandler {
	return &ActivityHandler{db: db}
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
	if action := c.Query("action"); action != "" {
		query = query.Where("action = ?", action)
	}

	query.Count(&total)
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&activities).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"activities": activities, "total": total})
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

	h.db.Model(&model.ActivityLog{}).Count(&activityTotal)
	h.db.Model(&model.ActivityLog{}).Order("created_at DESC").Limit(limit).Find(&activities)

	h.db.Model(&model.Idea{}).Count(&totalIdeas)

	h.db.Model(&model.Idea{}).Select(rankingCols).
		Order("like_count DESC, created_at DESC").Limit(5).Find(&popular)
	h.db.Model(&model.Idea{}).Select(rankingCols).
		Order("flower_count DESC, created_at DESC").Limit(5).Find(&flowers)
	h.db.Model(&model.Idea{}).Select(rankingCols).
		Order("fork_count DESC, created_at DESC").Limit(5).Find(&forks)

	c.JSON(http.StatusOK, gin.H{
		"stats":        stats,
		"activities":   activities,
		"total":        activityTotal,
		"total_ideas":  totalIdeas,
		"rankings": gin.H{
			"popular": popular,
			"flowers": flowers,
			"forks":   forks,
		},
	})
}
