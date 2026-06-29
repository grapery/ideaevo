package handler

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/middleware"
	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service"
)

type UserAuthHandler struct {
	userSvc *service.UserService
	authSvc *service.AuthService
}

func NewUserAuthHandler(userSvc *service.UserService, authSvc *service.AuthService) *UserAuthHandler {
	return &UserAuthHandler{userSvc: userSvc, authSvc: authSvc}
}

func (h *UserAuthHandler) Register(c *gin.Context) {
	var input service.RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	user, err := h.userSvc.Register(input)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": ServiceError(err)})
		return
	}

	token, err := h.authSvc.GenerateUserJWT(user.ID, string(user.Role))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": FriendlyMessage("failed to generate token")})
		return
	}

	middleware.SetJWTCookie(c, token, 86400)
	c.JSON(http.StatusCreated, gin.H{"user": model.ToUserResponse(user), "token": token, "message": "注册成功，请查收验证邮件"})
}

func (h *UserAuthHandler) Login(c *gin.Context) {
	var input struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	user, err := h.userSvc.LoginEmail(input.Email, input.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "邮箱或密码错误"})
		return
	}

	token, err := h.authSvc.GenerateUserJWT(user.ID, string(user.Role))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": FriendlyMessage("failed to generate token")})
		return
	}

	middleware.SetJWTCookie(c, token, 86400)
	c.JSON(http.StatusOK, gin.H{"user": model.ToUserResponse(user), "token": token})
}

func (h *UserAuthHandler) VerifyEmail(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyMessage("missing token")})
		return
	}

	if err := h.userSvc.VerifyEmail(token); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "邮箱验证成功"})
}

func (h *UserAuthHandler) ForgotPassword(c *gin.Context) {
	var input struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	_ = h.userSvc.RequestPasswordReset(input.Email)
	c.JSON(http.StatusOK, gin.H{"message": "如果该邮箱已注册，重置邮件已发送"})
}

func (h *UserAuthHandler) ResetPassword(c *gin.Context) {
	var input struct {
		Token       string `json:"token" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	if err := h.userSvc.ResetPassword(input.Token, input.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "密码重置成功"})
}

func (h *UserAuthHandler) AppleLogin(c *gin.Context) {
	var input struct {
		IdentityToken string `json:"identity_token" binding:"required"`
		Email         string `json:"email"`
		Name          string `json:"name"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	if !h.authSvc.AppleEnabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "apple_not_configured"})
		return
	}

	identity, err := h.authSvc.VerifyAppleIdentityToken(input.IdentityToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "apple_auth_failed"})
		return
	}

	email := identity.Email
	if email == "" {
		email = strings.TrimSpace(input.Email)
	}
	name := strings.TrimSpace(input.Name)

	user, err := h.userSvc.FindOrCreateAppleUser(identity.Sub, email, name)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": ServiceError(err)})
		return
	}

	token, err := h.authSvc.GenerateUserJWT(user.ID, string(user.Role))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": FriendlyMessage("failed to generate token")})
		return
	}

	middleware.SetJWTCookie(c, token, 86400)
	c.JSON(http.StatusOK, gin.H{"user": model.ToUserResponse(user), "token": token})
}

func (h *UserAuthHandler) Me(c *gin.Context) {
	userID, _ := c.Get("user_id")
	user, err := h.userSvc.GetByID(userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": FriendlyMessage("user not found")})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": model.ToUserResponse(user)})
}

func (h *UserAuthHandler) Logout(c *gin.Context) {
	middleware.ClearJWTCookie(c)
	middleware.ClearPendingCookie(c)
	c.JSON(http.StatusOK, gin.H{"message": "已退出"})
}

func (h *UserAuthHandler) GoogleLogin(c *gin.Context) {
	state, _ := generateState()
	oauthMode := setOAuthMode(c)
	c.SetCookie("oauth_state", state, 300, "/", "", false, true)
	authURL := h.authSvc.GoogleAuthURL(state)
	if authURL == "" {
		if oauthMode != "" {
			h.redirectOAuthResult(c, oauthMode, "error", "google", "", "", "google_not_configured")
			return
		}
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": FriendlyMessage("google oauth not configured")})
		return
	}
	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

func (h *UserAuthHandler) GoogleCallback(c *gin.Context) {
	oauthMode := getOAuthMode(c)
	state := c.Query("state")
	savedState, _ := c.Cookie("oauth_state")
	if state == "" || state != savedState {
		clearOAuthCookies(c)
		h.redirectOAuthResult(c, oauthMode, "error", "google", "", "", "oauth_state")
		return
	}
	clearOAuthCookies(c)

	code := c.Query("code")
	info, err := h.authSvc.ExchangeGoogleCode(code)
	if err != nil {
		h.redirectOAuthResult(c, oauthMode, "error", "google", "", "", "oauth_failed")
		return
	}

	user, err := h.userSvc.FindOrCreateGoogleUser(info.ID, info.Email, info.Name, info.Picture)
	if err != nil {
		h.redirectOAuthResult(c, oauthMode, "error", "google", "", "", "oauth_conflict")
		return
	}

	token, err := h.authSvc.GenerateUserJWT(user.ID, string(user.Role))
	if err != nil {
		h.redirectOAuthResult(c, oauthMode, "error", "google", "", "", "oauth_token")
		return
	}

	middleware.SetJWTCookie(c, token, 86400)
	h.redirectOAuthResult(c, oauthMode, "success", "google", token, "", "")
}

func (h *UserAuthHandler) WeChatLogin(c *gin.Context) {
	state, _ := generateState()
	oauthMode := setOAuthMode(c)
	c.SetCookie("oauth_state", state, 300, "/", "", false, true)
	authURL := h.authSvc.WeChatAuthURL(state)
	if authURL == "" {
		if oauthMode != "" {
			h.redirectOAuthResult(c, oauthMode, "error", "wechat", "", "", "wechat_not_configured")
			return
		}
		c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/login?error=wechat_not_configured")
		return
	}
	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

func (h *UserAuthHandler) WeChatCallback(c *gin.Context) {
	oauthMode := getOAuthMode(c)
	state := c.Query("state")
	savedState, _ := c.Cookie("oauth_state")
	if state == "" || state != savedState {
		clearOAuthCookies(c)
		h.redirectOAuthResult(c, oauthMode, "error", "wechat", "", "", "oauth_state")
		return
	}
	clearOAuthCookies(c)

	code := c.Query("code")
	info, err := h.authSvc.ExchangeWeChatCode(code)
	if err != nil {
		h.redirectOAuthResult(c, oauthMode, "error", "wechat", "", "", "wechat_oauth_failed")
		return
	}

	user, err := h.userSvc.FindOrCreateWeChatUser(info)
	if err != nil {
		h.redirectOAuthResult(c, oauthMode, "error", "wechat", "", "", "oauth_conflict")
		return
	}

	if !user.PhoneVerified {
		pending, err := h.authSvc.GeneratePendingJWT(user.ID)
		if err != nil {
			h.redirectOAuthResult(c, oauthMode, "error", "wechat", "", "", "oauth_token")
			return
		}
		middleware.SetPendingCookie(c, pending, 900)
		h.redirectOAuthResult(c, oauthMode, "pending", "wechat", "", pending, "")
		return
	}

	token, err := h.authSvc.GenerateUserJWT(user.ID, string(user.Role))
	if err != nil {
		h.redirectOAuthResult(c, oauthMode, "error", "wechat", "", "", "oauth_token")
		return
	}

	middleware.SetJWTCookie(c, token, 86400)
	h.redirectOAuthResult(c, oauthMode, "success", "wechat", token, "", "")
}

func setOAuthMode(c *gin.Context) string {
	mode := c.Query("mode")
	if mode == "popup" || mode == "mobile" {
		c.SetCookie("oauth_mode", mode, 300, "/", "", false, true)
		return mode
	}
	return ""
}

func getOAuthMode(c *gin.Context) string {
	mode, _ := c.Cookie("oauth_mode")
	return mode
}

func clearOAuthCookies(c *gin.Context) {
	c.SetCookie("oauth_state", "", -1, "/", "", false, true)
	c.SetCookie("oauth_mode", "", -1, "/", "", false, true)
}

func (h *UserAuthHandler) redirectOAuthResult(c *gin.Context, mode, status, provider, token, pendingToken, errorCode string) {
	switch mode {
	case "popup":
		h.redirectOAuthBridge(c, status, provider, errorCode)
	case "mobile":
		h.redirectOAuthMobile(c, status, provider, token, pendingToken, errorCode)
	default:
		if errorCode != "" {
			c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/login?error="+errorCode)
			return
		}
		if status == "pending" && provider == "wechat" {
			c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/oauth/wechat-phone")
			return
		}
		c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/oauth-result?provider="+provider)
	}
}

func (h *UserAuthHandler) redirectOAuthBridge(c *gin.Context, status, provider, errorCode string) {
	q := url.Values{}
	q.Set("status", status)
	q.Set("provider", provider)
	if errorCode != "" {
		q.Set("error_code", errorCode)
	}
	c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/oauth-bridge?"+q.Encode())
}

func (h *UserAuthHandler) redirectOAuthMobile(c *gin.Context, status, provider, token, pendingToken, errorCode string) {
	q := url.Values{}
	q.Set("status", status)
	q.Set("provider", provider)
	if token != "" {
		q.Set("token", token)
	}
	if pendingToken != "" {
		q.Set("pending_token", pendingToken)
	}
	if errorCode != "" {
		q.Set("error_code", errorCode)
	}
	c.Redirect(http.StatusTemporaryRedirect, "deimos://oauth/callback?"+q.Encode())
}

func generateState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
