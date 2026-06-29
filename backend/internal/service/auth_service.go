package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/wanye/ideaevo/internal/config"
	"github.com/wanye/ideaevo/internal/model"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const (
	JWTScopeFull       = "full"
	JWTScopePhoneBind  = "phone_bind"
)

type AuthService struct {
	jwtSecret        string
	jwtExpiry        time.Duration
	oauthConfig      *oauth2.Config
	frontendURL      string
	wechatAppID      string
	wechatAppSecret  string
	wechatRedirectURL string
	appleBundleID    string
}

type GoogleUserInfo struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

type WeChatTokenResponse struct {
	AccessToken  string `json:"access_token"`
	OpenID       string `json:"openid"`
	UnionID      string `json:"unionid"`
	ErrCode      int    `json:"errcode"`
	ErrMsg       string `json:"errmsg"`
}

type WeChatUserInfoResponse struct {
	OpenID     string `json:"openid"`
	UnionID    string `json:"unionid"`
	Nickname   string `json:"nickname"`
	HeadImgURL string `json:"headimgurl"`
	ErrCode    int    `json:"errcode"`
	ErrMsg     string `json:"errmsg"`
}

func NewAuthService(cfg *config.Config) *AuthService {
	s := &AuthService{
		jwtSecret:         cfg.JWTSecret,
		jwtExpiry:         cfg.JWTExpiry,
		frontendURL:       cfg.FrontendURL,
		wechatAppID:       cfg.WeChatAppID,
		wechatAppSecret:   cfg.WeChatAppSecret,
		wechatRedirectURL: cfg.WeChatRedirectURL,
		appleBundleID:     cfg.AppleBundleID,
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
	return s.generateJWT(userID, role, JWTScopeFull, s.jwtExpiry)
}

func (s *AuthService) GeneratePendingJWT(userID string) (string, error) {
	return s.generateJWT(userID, string(model.RoleUser), JWTScopePhoneBind, 15*time.Minute)
}

func (s *AuthService) generateJWT(userID, role, scope string, expiry time.Duration) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"role":    role,
		"scope":   scope,
		"exp":     time.Now().Add(expiry).Unix(),
		"iat":     time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

func (s *AuthService) ParseJWT(tokenStr string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return []byte(s.jwtSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid claims")
	}
	return claims, nil
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

func (s *AuthService) WeChatEnabled() bool {
	return s.wechatAppID != "" && s.wechatAppSecret != "" && s.wechatRedirectURL != ""
}

func (s *AuthService) WeChatAuthURL(state string) string {
	if !s.WeChatEnabled() {
		return ""
	}
	params := url.Values{}
	params.Set("appid", s.wechatAppID)
	params.Set("redirect_uri", s.wechatRedirectURL)
	params.Set("response_type", "code")
	params.Set("scope", "snsapi_login")
	params.Set("state", state)
	return "https://open.weixin.qq.com/connect/qrconnect?" + params.Encode() + "#wechat_redirect"
}

func (s *AuthService) ExchangeWeChatCode(code string) (*WeChatUserInfo, error) {
	if !s.WeChatEnabled() {
		return nil, fmt.Errorf("wechat oauth not configured")
	}

	tokenURL := fmt.Sprintf(
		"https://api.weixin.qq.com/sns/oauth2/access_token?appid=%s&secret=%s&code=%s&grant_type=authorization_code",
		url.QueryEscape(s.wechatAppID),
		url.QueryEscape(s.wechatAppSecret),
		url.QueryEscape(code),
	)
	resp, err := http.Get(tokenURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var tokenResp WeChatTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, err
	}
	if tokenResp.ErrCode != 0 {
		return nil, fmt.Errorf("wechat token error: %s", tokenResp.ErrMsg)
	}
	if tokenResp.AccessToken == "" || tokenResp.OpenID == "" {
		return nil, fmt.Errorf("wechat token missing fields")
	}

	userURL := fmt.Sprintf(
		"https://api.weixin.qq.com/sns/userinfo?access_token=%s&openid=%s",
		url.QueryEscape(tokenResp.AccessToken),
		url.QueryEscape(tokenResp.OpenID),
	)
	userResp, err := http.Get(userURL)
	if err != nil {
		return nil, err
	}
	defer userResp.Body.Close()
	userBody, _ := io.ReadAll(userResp.Body)

	var wxUser WeChatUserInfoResponse
	if err := json.Unmarshal(userBody, &wxUser); err != nil {
		return nil, err
	}
	if wxUser.ErrCode != 0 {
		return nil, fmt.Errorf("wechat userinfo error: %s", wxUser.ErrMsg)
	}

	return &WeChatUserInfo{
		OpenID:     firstNonEmpty(wxUser.OpenID, tokenResp.OpenID),
		UnionID:    firstNonEmpty(wxUser.UnionID, tokenResp.UnionID),
		Nickname:   wxUser.Nickname,
		HeadImgURL: wxUser.HeadImgURL,
	}, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func (s *AuthService) FrontendURL() string {
	return s.frontendURL
}
