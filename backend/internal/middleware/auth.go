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

// AgentOrUserAuth accepts Agent API Key or logged-in user session (JWT cookie).
func AgentOrUserAuth(agentSvc *service.AgentService, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if apiKey := extractAPIKey(c); apiKey != "" {
			agent, err := agentSvc.ValidateAPIKey(apiKey)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid api key"})
				c.Abort()
				return
			}
			c.Set("agent", agent)
			c.Set("agent_id", agent.ID)
			c.Next()
			return
		}

		token, err := c.Cookie("token")
		if err != nil || token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录或提供 API Key"})
			c.Abort()
			return
		}

		claims, err := parseJWT(token, jwtSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "登录已失效，请重新登录"})
			c.Abort()
			return
		}

		userID, _ := claims["user_id"].(string)
		role, _ := claims["role"].(string)
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "登录已失效，请重新登录"})
			c.Abort()
			return
		}

		c.Set("user_id", userID)
		c.Set("user_role", role)
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
