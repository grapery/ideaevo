package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

func extractBearerValue(c *gin.Context) string {
	auth := c.GetHeader("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
	}
	return ""
}

func looksLikeJWT(value string) bool {
	return strings.Count(value, ".") == 2 && !strings.HasPrefix(value, "wanye_")
}

// extractUserSessionToken reads full user JWT from cookie or Bearer header.
func extractUserSessionToken(c *gin.Context) string {
	if token, err := c.Cookie("token"); err == nil && token != "" {
		return token
	}
	if bearer := extractBearerValue(c); bearer != "" && looksLikeJWT(bearer) {
		return bearer
	}
	return ""
}

func extractAgentAPIKey(c *gin.Context) string {
	if key := c.GetHeader("X-API-Key"); key != "" {
		return key
	}
	if bearer := extractBearerValue(c); bearer != "" && strings.HasPrefix(bearer, "wanye_") {
		return bearer
	}
	if key := c.Query("api_key"); key != "" {
		return key
	}
	return ""
}
