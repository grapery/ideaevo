package handler

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// intQuery 解析整型 query 参数：缺失时返回默认值；非法值写 400 并返回 ok=false
// （调用方应直接 return）。此前各 handler 用 fmt.Sscanf/strconv.Atoi 静默吞掉
// 解析错误，非数字会把 limit 置 0 或残留初值，这里统一改为显式拒绝。
func intQuery(c *gin.Context, name string, def int) (int, bool) {
	raw := c.Query(name)
	if raw == "" {
		return def, true
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("query 参数 %s 必须是整数", name)})
		return 0, false
	}
	return n, true
}
