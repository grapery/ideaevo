package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSetOAuthModeIfPopup(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("sets cookie when mode is popup", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/auth/google?mode=popup", nil)

		if !setOAuthModeIfPopup(c) {
			t.Fatal("expected popup mode")
		}

		cookie := findCookie(w, "oauth_mode")
		if cookie == nil || cookie.Value != "popup" {
			t.Fatalf("expected oauth_mode=popup cookie, got %#v", cookie)
		}
	})

	t.Run("no cookie for default mode", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/auth/google", nil)

		if setOAuthModeIfPopup(c) {
			t.Fatal("expected non-popup mode")
		}
		if findCookie(w, "oauth_mode") != nil {
			t.Fatal("expected no oauth_mode cookie")
		}
	})
}

func findCookie(w *httptest.ResponseRecorder, name string) *http.Cookie {
	for _, c := range w.Result().Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}
