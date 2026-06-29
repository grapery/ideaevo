package service

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const appleJWKSURL = "https://appleid.apple.com/auth/keys"

type AppleIdentity struct {
	Sub   string
	Email string
}

type appleJWKS struct {
	Keys []appleJWK `json:"keys"`
}

type appleJWK struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type appleJWKSCache struct {
	mu        sync.RWMutex
	keys      map[string]*rsa.PublicKey
	fetchedAt time.Time
}

var appleKeys appleJWKSCache

func (s *AuthService) AppleEnabled() bool {
	return strings.TrimSpace(s.appleBundleID) != ""
}

func (s *AuthService) VerifyAppleIdentityToken(tokenStr string) (*AppleIdentity, error) {
	if !s.AppleEnabled() {
		return nil, fmt.Errorf("apple sign in not configured")
	}

	parser := jwt.NewParser(jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}))
	unverified, _, err := parser.ParseUnverified(tokenStr, jwt.MapClaims{})
	if err != nil {
		return nil, fmt.Errorf("invalid apple token: %w", err)
	}

	kid, _ := unverified.Header["kid"].(string)
	if kid == "" {
		return nil, errors.New("apple token missing kid")
	}

	pub, err := applePublicKey(kid)
	if err != nil {
		return nil, err
	}

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if t.Method.Alg() != jwt.SigningMethodRS256.Alg() {
			return nil, fmt.Errorf("unexpected signing method: %s", t.Method.Alg())
		}
		return pub, nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("apple token verification failed: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid apple claims")
	}

	iss, _ := claims["iss"].(string)
	if iss != "https://appleid.apple.com" {
		return nil, errors.New("invalid apple token issuer")
	}

	aud, _ := claims["aud"].(string)
	if aud != s.appleBundleID {
		return nil, errors.New("invalid apple token audience")
	}

	sub, _ := claims["sub"].(string)
	if sub == "" {
		return nil, errors.New("apple token missing sub")
	}

	email, _ := claims["email"].(string)
	return &AppleIdentity{Sub: sub, Email: email}, nil
}

func applePublicKey(kid string) (*rsa.PublicKey, error) {
	appleKeys.mu.RLock()
	if key, ok := appleKeys.keys[kid]; ok && time.Since(appleKeys.fetchedAt) < time.Hour {
		appleKeys.mu.RUnlock()
		return key, nil
	}
	appleKeys.mu.RUnlock()

	appleKeys.mu.Lock()
	defer appleKeys.mu.Unlock()

	if key, ok := appleKeys.keys[kid]; ok && time.Since(appleKeys.fetchedAt) < time.Hour {
		return key, nil
	}

	resp, err := http.Get(appleJWKSURL)
	if err != nil {
		return nil, fmt.Errorf("fetch apple jwks: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var jwks appleJWKS
	if err := json.Unmarshal(body, &jwks); err != nil {
		return nil, err
	}

	keys := make(map[string]*rsa.PublicKey, len(jwks.Keys))
	for _, jwk := range jwks.Keys {
		if jwk.Kty != "RSA" || jwk.Kid == "" {
			continue
		}
		pub, err := rsaPublicKeyFromJWK(jwk.N, jwk.E)
		if err != nil {
			continue
		}
		keys[jwk.Kid] = pub
	}
	if len(keys) == 0 {
		return nil, errors.New("apple jwks empty")
	}

	appleKeys.keys = keys
	appleKeys.fetchedAt = time.Now()

	key, ok := keys[kid]
	if !ok {
		return nil, errors.New("apple public key not found")
	}
	return key, nil
}

func rsaPublicKeyFromJWK(nStr, eStr string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nStr)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(eStr)
	if err != nil {
		return nil, err
	}

	n := new(big.Int).SetBytes(nBytes)
	e := 0
	for _, b := range eBytes {
		e = e<<8 + int(b)
	}
	if e == 0 {
		return nil, errors.New("invalid rsa exponent")
	}
	return &rsa.PublicKey{N: n, E: e}, nil
}
