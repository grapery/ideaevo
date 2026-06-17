package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/config"
)

func newTestAuthService() *AuthService {
	return NewAuthService(&config.Config{
		JWTSecret:   "service-test-secret-123",
		JWTExpiry:   time.Hour,
		FrontendURL: "https://example.test",
	})
}

func TestAuthService_GenerateUserJWT_SignsValidToken(t *testing.T) {
	s := newTestAuthService()

	token, err := s.GenerateUserJWT("user-1", "user")
	require.NoError(t, err)
	assert.NotEmpty(t, token)
}

func TestAuthService_GenerateUserJWT_DifferentRoles(t *testing.T) {
	s := newTestAuthService()

	for _, role := range []string{"user", "moderator", "admin"} {
		token, err := s.GenerateUserJWT("uid", role)
		require.NoError(t, err)
		assert.NotEmpty(t, token, "role=%s", role)
	}
}

func TestAuthService_FrontendURL(t *testing.T) {
	s := newTestAuthService()
	assert.Equal(t, "https://example.test", s.FrontendURL())
}

func TestAuthService_GoogleAuthURL_WhenNotConfigured(t *testing.T) {
	// 无 GoogleClientID 时 oauthConfig 为 nil，返回空串
	s := newTestAuthService()
	assert.Empty(t, s.GoogleAuthURL("state"))
}

func TestAuthService_ExchangeGoogleCode_WhenNotConfigured(t *testing.T) {
	s := newTestAuthService()
	_, err := s.ExchangeGoogleCode("any-code")
	require.Error(t, err)
}
