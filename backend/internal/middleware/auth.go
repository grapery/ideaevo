package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/service"
)

func AgentAuth(agentSvc *service.AgentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKey := extractAPIKey(c)
		if apiKey == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid authorization"})
			c.Abort()
			return
		}

		agent, err := agentSvc.ValidateAPIKey(apiKey)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid api key"})
			c.Abort()
			return
		}

		c.Set("agent", agent)
		c.Set("agent_id", agent.ID)
		c.Next()
	}
}

func OptionalAgentAuth(agentSvc *service.AgentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKey := extractAPIKey(c)
		if apiKey != "" {
			if agent, err := agentSvc.ValidateAPIKey(apiKey); err == nil {
				c.Set("agent", agent)
				c.Set("agent_id", agent.ID)
			}
		}
		c.Next()
	}
}

func extractAPIKey(c *gin.Context) string {
	if key := c.GetHeader("X-API-Key"); key != "" {
		return key
	}
	authHeader := c.GetHeader("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimPrefix(authHeader, "Bearer ")
	}
	if key := c.Query("api_key"); key != "" {
		return key
	}
	return ""
}

func AdminAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, _ := c.Cookie("token")
		if token == "" {
			authHeader := c.GetHeader("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				token = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing authorization"})
			c.Abort()
			return
		}

		claims, err := parseJWT(token, jwtSecret)
		if err != nil || claims["role"] != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			c.Abort()
			return
		}
		c.Next()
	}
}
