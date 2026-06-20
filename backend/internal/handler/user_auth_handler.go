package handler

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"

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
	c.JSON(http.StatusCreated, gin.H{"user": model.ToUserResponse(user), "message": "注册成功，请查收验证邮件"})
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
	c.JSON(http.StatusOK, gin.H{"user": model.ToUserResponse(user)})
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
	c.SetCookie("oauth_state", state, 300, "/", "", false, true)
	url := h.authSvc.GoogleAuthURL(state)
	if url == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": FriendlyMessage("google oauth not configured")})
		return
	}
	c.Redirect(http.StatusTemporaryRedirect, url)
}

func (h *UserAuthHandler) GoogleCallback(c *gin.Context) {
	state := c.Query("state")
	savedState, _ := c.Cookie("oauth_state")
	if state == "" || state != savedState {
		c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/login?error=oauth_state")
		return
	}
	c.SetCookie("oauth_state", "", -1, "/", "", false, true)

	code := c.Query("code")
	info, err := h.authSvc.ExchangeGoogleCode(code)
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/login?error=oauth_failed")
		return
	}

	user, err := h.userSvc.FindOrCreateGoogleUser(info.ID, info.Email, info.Name, info.Picture)
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/login?error=oauth_conflict")
		return
	}

	token, err := h.authSvc.GenerateUserJWT(user.ID, string(user.Role))
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/login?error=oauth_token")
		return
	}

	middleware.SetJWTCookie(c, token, 86400)
	c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/oauth-result?provider=google")
}

func (h *UserAuthHandler) WeChatLogin(c *gin.Context) {
	state, _ := generateState()
	c.SetCookie("oauth_state", state, 300, "/", "", false, true)
	url := h.authSvc.WeChatAuthURL(state)
	if url == "" {
		c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/login?error=wechat_not_configured")
		return
	}
	c.Redirect(http.StatusTemporaryRedirect, url)
}

func (h *UserAuthHandler) WeChatCallback(c *gin.Context) {
	state := c.Query("state")
	savedState, _ := c.Cookie("oauth_state")
	if state == "" || state != savedState {
		c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/login?error=oauth_state")
		return
	}
	c.SetCookie("oauth_state", "", -1, "/", "", false, true)

	code := c.Query("code")
	info, err := h.authSvc.ExchangeWeChatCode(code)
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/login?error=wechat_oauth_failed")
		return
	}

	user, err := h.userSvc.FindOrCreateWeChatUser(info)
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/login?error=oauth_conflict")
		return
	}

	if !user.PhoneVerified {
		pending, err := h.authSvc.GeneratePendingJWT(user.ID)
		if err != nil {
			c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/login?error=oauth_token")
			return
		}
		middleware.SetPendingCookie(c, pending, 900)
		c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/oauth/wechat-phone")
		return
	}

	token, err := h.authSvc.GenerateUserJWT(user.ID, string(user.Role))
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/login?error=oauth_token")
		return
	}

	middleware.SetJWTCookie(c, token, 86400)
	c.Redirect(http.StatusTemporaryRedirect, h.authSvc.FrontendURL()+"/oauth-result?provider=wechat")
}

func generateState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
