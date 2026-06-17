package middleware

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testJWTSecret = "test-jwt-secret-123"

func TestGenerateJWT_ParseJWT_RoundTrip(t *testing.T) {
	token, err := GenerateJWT(testJWTSecret, "user-1", "user", time.Hour)
	require.NoError(t, err)
	assert.NotEmpty(t, token)

	claims, err := parseJWT(token, testJWTSecret)
	require.NoError(t, err)
	assert.Equal(t, "user-1", claims["user_id"])
	assert.Equal(t, "user", claims["role"])
}

func TestGenerateAdminToken(t *testing.T) {
	token, err := GenerateAdminToken(testJWTSecret)
	require.NoError(t, err)

	claims, err := parseJWT(token, testJWTSecret)
	require.NoError(t, err)
	assert.Equal(t, "admin", claims["user_id"])
	assert.Equal(t, "admin", claims["role"])
}

func TestParseJWT_ExpiredToken(t *testing.T) {
	token, err := GenerateJWT(testJWTSecret, "u1", "user", -time.Hour)
	require.NoError(t, err)

	_, err = parseJWT(token, testJWTSecret)
	assert.Error(t, err)
}

func TestParseJWT_WrongSecret(t *testing.T) {
	token, err := GenerateJWT(testJWTSecret, "u1", "user", time.Hour)
	require.NoError(t, err)

	_, err = parseJWT(token, "different-secret")
	assert.Error(t, err)
}

func TestParseJWT_MalformedToken(t *testing.T) {
	_, err := parseJWT("not-a-real-token", testJWTSecret)
	assert.Error(t, err)
}

func TestParseJWT_EmptyToken(t *testing.T) {
	_, err := parseJWT("", testJWTSecret)
	assert.Error(t, err)
}
