package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/wanye/ideaevo/internal/config"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type AuthService struct {
 jwtSecret   string
 jwtExpiry   time.Duration
 oauthConfig *oauth2.Config
 frontendURL string
}

type GoogleUserInfo struct {
 ID      string `json:"id"`
 Email   string `json:"email"`
 Name    string `json:"name"`
 Picture string `json:"picture"`
}

func NewAuthService(cfg *config.Config) *AuthService {
	s := &AuthService{
		jwtSecret:   cfg.JWTSecret,
		jwtExpiry:   cfg.JWTExpiry,
		frontendURL: cfg.FrontendURL,
	}

	if cfg.GoogleClientID != "" {
		s.oauthConfig = &oauth2.Config{
			ClientID:     cfg.GoogleClientID,
			ClientSecret: cfg.GoogleClientSecret,
			RedirectURL:  cfg.GoogleRedirectURL,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     google.Endpoint,
		}
	}

	return s
}

func (s *AuthService) GenerateUserJWT(userID, role string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"role":    role,
		"exp":     time.Now().Add(s.jwtExpiry).Unix(),
		"iat":     time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

func (s *AuthService) GoogleAuthURL(state string) string {
	if s.oauthConfig == nil {
		return ""
	}
	return s.oauthConfig.AuthCodeURL(state)
}

func (s *AuthService) ExchangeGoogleCode(code string) (*GoogleUserInfo, error) {
	if s.oauthConfig == nil {
		return nil, fmt.Errorf("google oauth not configured")
	}

	token, err := s.oauthConfig.Exchange(context.Background(), code)
	if err != nil {
		return nil, fmt.Errorf("oauth exchange: %w", err)
	}

	client := s.oauthConfig.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return nil, fmt.Errorf("get user info: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var info GoogleUserInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, err
	}
	return &info, nil
}

func (s *AuthService) FrontendURL() string {
	return s.frontendURL
}
