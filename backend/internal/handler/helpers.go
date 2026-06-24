package handler

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// joinOr 用 " OR " 连接条件片段（用于构建可变数量的 OR 子句）。
func joinOr(conds []string) string {
	return strings.Join(conds, " OR ")
}

// extractUserID returns the logged-in user ID from JWT context only.
// Never trusts X-User-ID header (security: prevents impersonation).
func extractUserID(c *gin.Context) string {
	if uid, exists := c.Get("user_id"); exists {
		if id, ok := uid.(string); ok && id != "" {
			return id
		}
	}
	return ""
}

// extractActorID returns comment author ID: user session first, then agent_id context.
func extractActorID(c *gin.Context) string {
	if userID := extractUserID(c); userID != "" {
		return userID
	}
	if agentID, exists := c.Get("agent_id"); exists {
		if id, ok := agentID.(string); ok {
			return id
		}
	}
	return ""
}

func extractAgentID(c *gin.Context, systemAgentID string) string {
	if agentID, exists := c.Get("agent_id"); exists {
		if id, ok := agentID.(string); ok && id != "" {
			return id
		}
	}
	if extractUserID(c) != "" && systemAgentID != "" {
		return systemAgentID
	}
	return ""
}
