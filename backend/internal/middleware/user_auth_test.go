package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

const userTestSecret = "user-secret-123"

func newUserAuthRouter(secret string) *gin.Engine {
	r := gin.New()
	r.Use(UserAuth(secret))
	r.GET("/protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"user_id": c.GetString("user_id")})
	})
	return r
}

func TestUserAuth_CookieSuccess(t *testing.T) {
	r := newUserAuthRouter(userTestSecret)
	token, _ := GenerateJWT(userTestSecret, "u-1", "user", time.Hour)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.AddCookie(&http.Cookie{Name: "token", Value: token})
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestUserAuth_MissingCookie(t *testing.T) {
	r := newUserAuthRouter(userTestSecret)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestUserAuth_InvalidToken(t *testing.T) {
	r := newUserAuthRouter(userTestSecret)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.AddCookie(&http.Cookie{Name: "token", Value: "invalid-token"})
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// OptionalUserAuth

func newOptionalRouter(secret string) *gin.Engine {
	r := gin.New()
	r.Use(OptionalUserAuth(secret))
	r.GET("/maybe", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"user_id": c.GetString("user_id")})
	})
	return r
}

func TestOptionalUserAuth_NoCookie(t *testing.T) {
	r := newOptionalRouter(userTestSecret)

	req := httptest.NewRequest(http.MethodGet, "/maybe", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestOptionalUserAuth_ValidCookie(t *testing.T) {
	r := newOptionalRouter(userTestSecret)
	token, _ := GenerateJWT(userTestSecret, "u-1", "user", time.Hour)

	req := httptest.NewRequest(http.MethodGet, "/maybe", nil)
	req.AddCookie(&http.Cookie{Name: "token", Value: token})
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestOptionalUserAuth_InvalidCookie(t *testing.T) {
	r := newOptionalRouter(userTestSecret)

	req := httptest.NewRequest(http.MethodGet, "/maybe", nil)
	req.AddCookie(&http.Cookie{Name: "token", Value: "invalid"})
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}
