package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAuthService_AppleEnabled(t *testing.T) {
	svc := &AuthService{appleBundleID: "com.wanye.deimos"}
	assert.True(t, svc.AppleEnabled())

	empty := &AuthService{}
	assert.False(t, empty.AppleEnabled())
}

func TestRSAFromJWK(t *testing.T) {
	// Apple JWKS uses base64url-encoded modulus/exponent; smoke-test decoder with minimal values.
	pub, err := rsaPublicKeyFromJWK("AQAB", "AQAB")
	assert.NoError(t, err)
	assert.NotNil(t, pub)
}
