package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func UserAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie("token")
		if err != nil || token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "login required"})
			c.Abort()
			return
		}

		claims, err := parseJWT(token, jwtSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid session"})
			c.Abort()
			return
		}

		userID, _ := claims["user_id"].(string)
		role, _ := claims["role"].(string)
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid session"})
			c.Abort()
			return
		}

		c.Set("user_id", userID)
		c.Set("user_role", role)
		c.Next()
	}
}

func OptionalUserAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, _ := c.Cookie("token")
		if token == "" {
			c.Next()
			return
		}

		claims, err := parseJWT(token, jwtSecret)
		if err != nil {
			c.Next()
			return
		}

		userID, _ := claims["user_id"].(string)
		role, _ := claims["role"].(string)
		if userID != "" {
			c.Set("user_id", userID)
			c.Set("user_role", role)
		}
		c.Next()
	}
}

func isSecure(c *gin.Context) bool {
	if c.Request.TLS != nil {
		return true
	}
	return c.GetHeader("X-Forwarded-Proto") == "https"
}

func SetJWTCookie(c *gin.Context, token string, maxAge int) {
	c.SetCookie("token", token, maxAge, "/", "", isSecure(c), true)
}

func ClearJWTCookie(c *gin.Context) {
	c.SetCookie("token", "", -1, "/", "", isSecure(c), true)
}
