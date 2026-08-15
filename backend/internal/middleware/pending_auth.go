package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// PendingOrUserAuth accepts full session (token) or phone-bind pending session (pending_token).
func PendingOrUserAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if token, err := c.Cookie("token"); err == nil && token != "" {
			if claims, err := parseJWT(token, jwtSecret); err == nil {
				if userID, _ := claims["user_id"].(string); userID != "" {
					c.Set("user_id", userID)
					c.Set("jwt_scope", "")
					c.Next()
					return
				}
			}
		}

		if bearer := extractBearerValue(c); bearer != "" && looksLikeJWT(bearer) {
			if claims, err := parseJWT(bearer, jwtSecret); err == nil {
				userID, _ := claims["user_id"].(string)
				scope, _ := claims["scope"].(string)
				if userID != "" {
					if scope == "phone_bind" {
						c.Set("user_id", userID)
						c.Set("jwt_scope", scope)
						c.Next()
						return
					}
					if scope == "" {
						c.Set("user_id", userID)
						c.Set("jwt_scope", "")
						c.Next()
						return
					}
				}
			}
		}

		if token, err := c.Cookie("pending_token"); err == nil && token != "" {
			if claims, err := parseJWT(token, jwtSecret); err == nil {
				userID, _ := claims["user_id"].(string)
				scope, _ := claims["scope"].(string)
				if userID != "" && scope == "phone_bind" {
					c.Set("user_id", userID)
					c.Set("jwt_scope", scope)
					c.Next()
					return
				}
			}
		}

		c.JSON(http.StatusUnauthorized, gin.H{"error": "请先登录"})
		c.Abort()
	}
}

func SetPendingCookie(c *gin.Context, token string, maxAge int) {
	c.SetCookie("pending_token", token, maxAge, "/", "", isSecure(c), true)
}

func ClearPendingCookie(c *gin.Context) {
	c.SetCookie("pending_token", "", -1, "/", "", isSecure(c), true)
}
