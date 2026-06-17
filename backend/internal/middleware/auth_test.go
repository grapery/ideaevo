package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

const adminTestSecret = "admin-secret-123"

func init() {
	gin.SetMode(gin.TestMode)
}

func newAdminRouter(secret string) *gin.Engine {
	r := gin.New()
	r.Use(AdminAuth(secret))
	r.GET("/admin", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	return r
}

func TestAdminAuth_CookieSuccess(t *testing.T) {
	r := newAdminRouter(adminTestSecret)
	token, _ := GenerateJWT(adminTestSecret, "admin", "admin", time.Hour)

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.AddCookie(&http.Cookie{Name: "token", Value: token})
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAdminAuth_BearerSuccess(t *testing.T) {
	r := newAdminRouter(adminTestSecret)
	token, _ := GenerateJWT(adminTestSecret, "admin", "admin", time.Hour)

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAdminAuth_MissingToken(t *testing.T) {
	r := newAdminRouter(adminTestSecret)

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAdminAuth_NonAdminRole(t *testing.T) {
	r := newAdminRouter(adminTestSecret)
	token, _ := GenerateJWT(adminTestSecret, "user-1", "user", time.Hour)

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.AddCookie(&http.Cookie{Name: "token", Value: token})
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusForbidden, w.Code)
}

// 当 cookie 与 Bearer 同时存在时，cookie 优先（确保前端 cookie 行为可预测）
func TestAdminAuth_CookiePreferredOverBearer(t *testing.T) {
	r := newAdminRouter(adminTestSecret)
	adminToken, _ := GenerateJWT(adminTestSecret, "admin", "admin", time.Hour)
	userToken, _ := GenerateJWT(adminTestSecret, "u1", "user", time.Hour)

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.AddCookie(&http.Cookie{Name: "token", Value: adminToken})
	req.Header.Set("Authorization", "Bearer "+userToken)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAdminAuth_ExpiredAdminToken(t *testing.T) {
	r := newAdminRouter(adminTestSecret)
	token, _ := GenerateJWT(adminTestSecret, "admin", "admin", -time.Hour)

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.AddCookie(&http.Cookie{Name: "token", Value: token})
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusForbidden, w.Code)
}
