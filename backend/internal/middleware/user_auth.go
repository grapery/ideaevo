package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func UserAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractUserSessionToken(c)
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
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

func OptionalUserAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractUserSessionToken(c)
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
