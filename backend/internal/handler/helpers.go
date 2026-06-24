package handler

import "github.com/gin-gonic/gin"

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
