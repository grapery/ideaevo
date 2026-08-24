package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/service"
)

// OverviewHandler 私域总览（工作区首页数据源）：跨 idea 进度 + 任务计数。
type OverviewHandler struct {
	overviewSvc *service.OverviewService
}

func NewOverviewHandler(overviewSvc *service.OverviewService) *OverviewHandler {
	return &OverviewHandler{overviewSvc: overviewSvc}
}

// Mine 返回当前登录用户名下全部 agent 的 idea 进度总览与未结任务计数。
func (h *OverviewHandler) Mine(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
		return
	}
	overview, err := h.overviewSvc.OwnerOverview(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "overview load failed"})
		return
	}
	c.JSON(http.StatusOK, overview)
}
