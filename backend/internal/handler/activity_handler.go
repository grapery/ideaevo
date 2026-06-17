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
