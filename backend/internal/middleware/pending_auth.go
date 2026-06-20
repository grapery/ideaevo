package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// PendingOrUserAuth accepts full session (token) or phone-bind pending session (pending_token).
func PendingOrUserAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		for _, cookieName := range []string{"token", "pending_token"} {
			token, err := c.Cookie(cookieName)
			if err != nil || token == "" {
				continue
			}
			claims, err := parseJWT(token, jwtSecret)
			if err != nil {
				continue
			}
			userID, _ := claims["user_id"].(string)
			scope, _ := claims["scope"].(string)
			if userID == "" {
				continue
			}
			if cookieName == "pending_token" && scope != "phone_bind" {
				continue
			}
			c.Set("user_id", userID)
			c.Set("jwt_scope", scope)
			c.Next()
			return
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
