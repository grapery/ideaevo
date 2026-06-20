package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/middleware"
	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service"
)

type UserSettingsHandler struct {
	userSvc *service.UserService
	smsSvc  *service.SMSService
	assets  *service.ObjectStore
}

func NewUserSettingsHandler(userSvc *service.UserService, smsSvc *service.SMSService, assets *service.ObjectStore) *UserSettingsHandler {
	return &UserSettingsHandler{userSvc: userSvc, smsSvc: smsSvc, assets: assets}
}

func (h *UserSettingsHandler) UpdateProfile(c *gin.Context) {
	userID := c.GetString("user_id")
	var input service.UpdateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	if err := h.userSvc.UpdateProfile(userID, input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
		return
	}
	user, _ := h.userSvc.GetByID(userID)
	c.JSON(http.StatusOK, gin.H{"message": "profile updated", "user": model.ToUserResponse(user)})
}

func (h *UserSettingsHandler) ChangePassword(c *gin.Context) {
	userID := c.GetString("user_id")
	var input struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	if len(input.NewPassword) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyMessage("password must be 6-128 chars")})
		return
	}
	if err := h.userSvc.ChangePassword(userID, input.OldPassword, input.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "password changed"})
}

func (h *UserSettingsHandler) PresignUpload(c *gin.Context) {
	userID := c.GetString("user_id")
	var input struct {
		Kind        string `json:"kind" binding:"required"`
		ContentType string `json:"content_type" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	if h.assets == nil || !h.assets.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": FriendlyMessage("upload not configured")})
		return
	}
	result, err := h.assets.PresignPut(userID, input.Kind, input.ContentType)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *UserSettingsHandler) ResetAvatar(c *gin.Context) {
	userID := c.GetString("user_id")
	if err := h.userSvc.ResetAvatar(userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	user, _ := h.userSvc.GetByID(userID)
	c.JSON(http.StatusOK, gin.H{"user": model.ToUserResponse(user)})
}

func (h *UserSettingsHandler) ResetBackground(c *gin.Context) {
	userID := c.GetString("user_id")
	if err := h.userSvc.ResetBackground(userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": ServiceError(err)})
		return
	}
	user, _ := h.userSvc.GetByID(userID)
	c.JSON(http.StatusOK, gin.H{"user": model.ToUserResponse(user)})
}

func (h *UserSettingsHandler) DeleteAccount(c *gin.Context) {
	userID := c.GetString("user_id")
	var input service.DeleteAccountInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}
	if err := h.userSvc.DeleteAccount(userID, input, h.smsSvc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
		return
	}
	middleware.ClearJWTCookie(c)
	middleware.ClearPendingCookie(c)
	c.JSON(http.StatusOK, gin.H{"message": "account deleted"})
}

type PhoneAuthHandler struct {
	userSvc *service.UserService
	smsSvc  *service.SMSService
	authSvc *service.AuthService
}

func NewPhoneAuthHandler(userSvc *service.UserService, smsSvc *service.SMSService, authSvc *service.AuthService) *PhoneAuthHandler {
	return &PhoneAuthHandler{userSvc: userSvc, smsSvc: smsSvc, authSvc: authSvc}
}

func (h *PhoneAuthHandler) SendCode(c *gin.Context) {
	userID := c.GetString("user_id")
	scope := c.GetString("jwt_scope")

	var input struct {
		Phone   string `json:"phone" binding:"required"`
		Purpose string `json:"purpose"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	purpose := input.Purpose
	if purpose == "" {
		if scope == "phone_bind" {
			purpose = "wechat_bind"
		} else {
			purpose = "change_phone"
		}
	}

	if h.smsSvc == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": FriendlyMessage("sms not configured")})
		return
	}
	if err := h.smsSvc.SendOTP(input.Phone, purpose); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
		return
	}
	_ = userID
	c.JSON(http.StatusOK, gin.H{"message": "code sent"})
}

func (h *PhoneAuthHandler) Verify(c *gin.Context) {
	userID := c.GetString("user_id")
	scope := c.GetString("jwt_scope")

	var input struct {
		Phone string `json:"phone" binding:"required"`
		Code  string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": FriendlyBindError(err)})
		return
	}

	purpose := "wechat_bind"
	if scope != "phone_bind" {
		purpose = "change_phone"
	}

	if h.smsSvc == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": FriendlyMessage("sms not configured")})
		return
	}
	if err := h.smsSvc.VerifyOTP(input.Phone, input.Code, purpose); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
		return
	}

	user, err := h.userSvc.BindPhone(userID, input.Phone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": ServiceError(err)})
		return
	}

	if scope == "phone_bind" {
		token, err := h.authSvc.GenerateUserJWT(user.ID, string(user.Role))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": FriendlyMessage("failed to issue session")})
			return
		}
		middleware.ClearPendingCookie(c)
		middleware.SetJWTCookie(c, token, 86400)
	}

	c.JSON(http.StatusOK, gin.H{"user": model.ToUserResponse(user), "message": "phone verified"})
}

func (h *PhoneAuthHandler) Session(c *gin.Context) {
	userID := c.GetString("user_id")
	scope := c.GetString("jwt_scope")
	c.JSON(http.StatusOK, gin.H{
		"user_id": userID,
		"scope":   scope,
	})
}
