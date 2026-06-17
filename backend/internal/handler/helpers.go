package handler

import "github.com/gin-gonic/gin"

// extractActorID returns the user ID from X-User-ID header or agent_id context.
func extractActorID(c *gin.Context) string {
	if userID := c.GetHeader("X-User-ID"); userID != "" {
		return userID
	}
	if agentID, exists := c.Get("agent_id"); exists {
		if id, ok := agentID.(string); ok {
			return id
		}
	}
	return ""
}
