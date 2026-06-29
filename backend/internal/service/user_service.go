package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserService struct {
	db          *gorm.DB
	email       *EmailService
	frontendURL string
	assets      *ObjectStore
}

func NewUserService(db *gorm.DB, email *EmailService, frontendURL string, assets *ObjectStore) *UserService {
	return &UserService{db: db, email: email, frontendURL: frontendURL, assets: assets}
}

type RegisterInput struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

var phonePattern = regexp.MustCompile(`^1[3-9]\d{9}$`)

func normalizePhone(phone string) string {
	phone = strings.TrimSpace(phone)
	phone = strings.TrimPrefix(phone, "+86")
	return phone
}

func (s *UserService) applyDefaultMedia(user *model.User) error {
	avatar, bg := ApplyDefaultProfileMedia(user.ID)
	return s.db.Model(user).Updates(map[string]interface{}{
		"avatar_url":      avatar,
		"background_url":  bg,
		"avatar_source":   "dicebear",
	}).Error
}

func (s *UserService) Register(input RegisterInput) (*model.User, error) {
	var existing model.User
	if err := s.db.Where("email = ?", input.Email).First(&existing).Error; err == nil {
		return nil, errors.New("该邮箱已被注册")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	token, err := generateToken()
	if err != nil {
		return nil, err
	}

	user := &model.User{
		Name:             input.Name,
		Email:            input.Email,
		PasswordHash:     string(hash),
		AuthProvider:     "email",
		EmailVerifyToken: token,
	}

	if err := s.db.Create(user).Error; err != nil {
		return nil, err
	}
	_ = s.applyDefaultMedia(user)
	_ = s.email.SendVerificationEmail(user.Email, token, s.frontendURL)

	var refreshed model.User
	_ = s.db.First(&refreshed, "id = ?", user.ID).Error
	return &refreshed, nil
}

func (s *UserService) VerifyEmail(token string) error {
	var user model.User
	if err := s.db.Where("email_verify_token = ?", token).First(&user).Error; err != nil {
		return errors.New("验证链接无效")
	}
	return s.db.Model(&user).Updates(map[string]interface{}{
		"email_verified":     true,
		"email_verify_token": "",
	}).Error
}

func (s *UserService) LoginEmail(email, password string) (*model.User, error) {
	var user model.User
	if err := s.db.Where("email = ? AND auth_provider = ?", email, "email").First(&user).Error; err != nil {
		return nil, errors.New("邮箱或密码错误")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("邮箱或密码错误")
	}
	return &user, nil
}

func (s *UserService) RequestPasswordReset(email string) error {
	var user model.User
	if err := s.db.Where("email = ? AND auth_provider = ?", email, "email").First(&user).Error; err != nil {
		return nil
	}

	token, err := generateToken()
	if err != nil {
		return err
	}
	expiry := time.Now().Add(1 * time.Hour)

	if err := s.db.Model(&user).Updates(map[string]interface{}{
		"password_reset_token":  token,
		"password_reset_expiry": expiry,
	}).Error; err != nil {
		return err
	}

	_ = s.email.SendPasswordResetEmail(user.Email, token, s.frontendURL)
	return nil
}

func (s *UserService) ResetPassword(token, newPassword string) error {
	var user model.User
	if err := s.db.Where("password_reset_token = ?", token).First(&user).Error; err != nil {
		return errors.New("验证链接无效")
	}
	if user.PasswordResetExpiry == nil || user.PasswordResetExpiry.Before(time.Now()) {
		return errors.New("链接已过期，请重新申请")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	return s.db.Model(&user).Updates(map[string]interface{}{
		"password_hash":         string(hash),
		"password_reset_token":  "",
		"password_reset_expiry": nil,
	}).Error
}

func (s *UserService) FindOrCreateGoogleUser(googleID, email, name, avatarURL string) (*model.User, error) {
	var user model.User
	err := s.db.Where("auth_provider = ? AND auth_provider_id = ?", "google", googleID).First(&user).Error
	if err == nil {
		return &user, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	err = s.db.Where("email = ?", email).First(&user).Error
	if err == nil {
		return nil, errors.New("该邮箱已用密码注册，请使用密码登录")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	user = model.User{
		Name:           name,
		Email:          email,
		AuthProvider:   "google",
		AuthProviderID: googleID,
		AvatarURL:      avatarURL,
		AvatarSource:   "google",
		EmailVerified:  true,
	}
	if err := s.db.Create(&user).Error; err != nil {
		return nil, err
	}
	if user.AvatarURL == "" {
		_ = s.applyDefaultMedia(&user)
	} else {
		bg := DefaultBackgroundURL(user.ID)
		_ = s.db.Model(&user).Update("background_url", bg).Error
	}
	_ = s.db.First(&user, "id = ?", user.ID).Error
	return &user, nil
}

func (s *UserService) FindOrCreateAppleUser(appleID, email, name string) (*model.User, error) {
	var user model.User
	err := s.db.Where("auth_provider = ? AND auth_provider_id = ?", "apple", appleID).First(&user).Error
	if err == nil {
		return &user, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if email != "" {
		err = s.db.Where("email = ?", email).First(&user).Error
		if err == nil {
			return nil, errors.New("该邮箱已用密码注册，请使用密码登录")
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	if name == "" {
		name = "Apple 用户"
	}
	if email == "" {
		email = fmt.Sprintf("apple_%s@apple.local", appleID)
	}

	user = model.User{
		Name:           name,
		Email:          email,
		AuthProvider:   "apple",
		AuthProviderID: appleID,
		AvatarSource:   "default",
		EmailVerified:  true,
	}
	if err := s.db.Create(&user).Error; err != nil {
		return nil, err
	}
	_ = s.applyDefaultMedia(&user)
	_ = s.db.First(&user, "id = ?", user.ID).Error
	return &user, nil
}

type WeChatUserInfo struct {
	OpenID     string
	UnionID    string
	Nickname   string
	HeadImgURL string
}

func (s *UserService) FindOrCreateWeChatUser(info *WeChatUserInfo) (*model.User, error) {
	providerID := info.UnionID
	if providerID == "" {
		providerID = info.OpenID
	}

	var user model.User
	err := s.db.Where("auth_provider = ? AND auth_provider_id = ?", "wechat", providerID).First(&user).Error
	if err == nil {
		return &user, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	name := info.Nickname
	if name == "" {
		name = "微信用户"
	}

	user = model.User{
		Name:           name,
		Email:          fmt.Sprintf("wechat_%s@wechat.local", providerID),
		AuthProvider:   "wechat",
		AuthProviderID: providerID,
		AvatarURL:      info.HeadImgURL,
		AvatarSource:   "wechat",
		PhoneVerified:  false,
		EmailVerified:  true,
	}
	if err := s.db.Create(&user).Error; err != nil {
		return nil, err
	}
	if user.AvatarURL == "" {
		_ = s.applyDefaultMedia(&user)
	} else {
		bg := DefaultBackgroundURL(user.ID)
		_ = s.db.Model(&user).Update("background_url", bg).Error
	}
	_ = s.db.First(&user, "id = ?", user.ID).Error
	return &user, nil
}

func (s *UserService) BindPhone(userID, phone string) (*model.User, error) {
	phone = normalizePhone(phone)
	if !phonePattern.MatchString(phone) {
		return nil, errors.New("手机号格式不正确")
	}

	var taken model.User
	if err := s.db.Where("phone = ? AND id != ?", phone, userID).First(&taken).Error; err == nil {
		return nil, errors.New("该手机号已绑定其他账号")
	}

	var user model.User
	if err := s.db.First(&user, "id = ?", userID).Error; err != nil {
		return nil, err
	}

	phoneVal := phone
	if err := s.db.Model(&user).Updates(map[string]interface{}{
		"phone":          &phoneVal,
		"phone_verified": true,
		"updated_at":     time.Now(),
	}).Error; err != nil {
		return nil, err
	}
	_ = s.db.First(&user, "id = ?", userID).Error
	return &user, nil
}

func (s *UserService) GetByID(id string) (*model.User, error) {
	var user model.User
	if err := s.db.First(&user, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

type UserProfile struct {
	User           model.UserResponse `json:"user"`
	IdeaCount      int64              `json:"idea_count"`
	SessionCount   int64              `json:"session_count"`
	FollowerCount  int                `json:"follower_count"`
	FollowingCount int                `json:"following_count"`
}

func (s *UserService) GetProfile(userID string) (*UserProfile, error) {
	user, err := s.GetByID(userID)
	if err != nil {
		return nil, err
	}

	var sessionCount int64
	s.db.Model(&model.ChatSession{}).Where("user_id = ?", userID).Count(&sessionCount)

	// idea 属于 agent，跨该用户拥有的所有 agent 聚合计数。
	var ideaCount int64
	s.db.Model(&model.Idea{}).
		Joins("JOIN agents ON agents.id = ideas.agent_id").
		Where("agents.owner_user_id = ?", userID).Count(&ideaCount)

	return &UserProfile{
		User:           model.ToUserResponse(user),
		IdeaCount:      ideaCount,
		SessionCount:   sessionCount,
		FollowerCount:  user.FollowerCount,
		FollowingCount: user.FollowingCount,
	}, nil
}

func (s *UserService) GetUserSessions(userID string, limit, offset int) ([]model.ChatSession, int64, error) {
	var sessions []model.ChatSession
	var total int64
	s.db.Model(&model.ChatSession{}).Where("user_id = ?", userID).Count(&total)
	if err := s.db.Where("user_id = ?", userID).
		Order("updated_at DESC").
		Limit(limit).Offset(offset).
		Find(&sessions).Error; err != nil {
		return nil, 0, err
	}
	return sessions, total, nil
}

type UpdateProfileInput struct {
	Name          string  `json:"name" binding:"omitempty,min=1,max=64"`
	AvatarURL     string  `json:"avatar_url"`
	BackgroundURL string  `json:"background_url"`
	AvatarSource  string  `json:"avatar_source"`
	Bio           *string `json:"bio"`
}

func (s *UserService) UpdateProfile(userID string, input UpdateProfileInput) error {
	updates := map[string]interface{}{}
	if input.Name != "" {
		updates["name"] = input.Name
	}
	if input.Bio != nil {
		if len(*input.Bio) > 500 {
			return errors.New("个人简介不能超过 500 字")
		}
		updates["bio"] = *input.Bio
	}
	if input.AvatarURL != "" {
		if s.assets != nil && s.assets.IsAllowedURL(input.AvatarURL) {
			key, err := s.assets.KeyFromURL(input.AvatarURL)
			if err != nil {
				return errors.New("头像地址无效")
			}
			if err := s.assets.ValidateUploadedObject(key, "users", userID); err != nil {
					return err
				}
			} else if s.assets != nil && !strings.HasPrefix(input.AvatarURL, "https://api.dicebear.com/") {
				return errors.New("头像须来自允许的上传存储")
			}
			updates["avatar_url"] = input.AvatarURL
			if input.AvatarSource != "" {
				updates["avatar_source"] = input.AvatarSource
			}
		}
		if input.BackgroundURL != "" {
			if s.assets != nil && s.assets.IsAllowedURL(input.BackgroundURL) {
				key, err := s.assets.KeyFromURL(input.BackgroundURL)
				if err != nil {
					return errors.New("背景图地址无效")
				}
				if err := s.assets.ValidateUploadedObject(key, "users", userID); err != nil {
				return err
			}
		} else if s.assets != nil && !strings.HasPrefix(input.BackgroundURL, "https://api.dicebear.com/") {
			return errors.New("背景图须来自允许的上传存储")
		}
		updates["background_url"] = input.BackgroundURL
	}
	if len(updates) == 0 {
		return nil
	}
	updates["updated_at"] = time.Now()
	return s.db.Model(&model.User{}).Where("id = ?", userID).Updates(updates).Error
}

func (s *UserService) ResetAvatar(userID string) error {
	url := DefaultAvatarURL(userID)
	return s.db.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"avatar_url":    url,
		"avatar_source": "dicebear",
		"updated_at":    time.Now(),
	}).Error
}

func (s *UserService) ResetBackground(userID string) error {
	url := DefaultBackgroundURL(userID)
	return s.db.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"background_url": url,
		"updated_at":     time.Now(),
	}).Error
}

type DeleteAccountInput struct {
	Password      string `json:"password"`
	ConfirmText   string `json:"confirm_text"`
	Phone         string `json:"phone"`
	SMSCode       string `json:"sms_code"`
}

func (s *UserService) DeleteAccount(userID string, input DeleteAccountInput, sms *SMSService) error {
	user, err := s.GetByID(userID)
	if err != nil {
		return err
	}

	switch user.AuthProvider {
	case "email":
		if input.Password == "" {
			return errors.New("请输入密码确认")
		}
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
			return errors.New("密码不正确")
		}
	case "google", "apple":
		if input.ConfirmText != "DELETE" {
			return errors.New("请输入 DELETE 确认注销")
		}
	case "wechat":
		if !user.PhoneVerified {
			return errors.New("请先完成手机验证")
		}
		if sms == nil {
			return errors.New("短信服务不可用")
		}
		phone := normalizePhone(input.Phone)
		if phone != user.PhoneString() {
			return errors.New("手机号与绑定号码不一致")
		}
		if err := sms.VerifyOTP(phone, input.SMSCode, "account_delete"); err != nil {
			return err
		}
	default:
		return errors.New("不支持的登录方式")
	}

	if s.assets != nil {
		_ = s.assets.DeleteUserPrefix(userID)
	}

	s.db.Model(&model.Notification{}).
		Where("actor_type = ? AND actor_id = ?", "user", userID).
		Update("actor_name", "已注销用户")

	anonEmail := fmt.Sprintf("deleted_%s@deleted.local", userID)
	if err := s.db.Model(user).Updates(map[string]interface{}{
		"name":           "已注销用户",
		"email":          anonEmail,
		"phone":          nil,
		"phone_verified": false,
		"avatar_url":     "",
		"background_url": "",
		"bio":            "",
		"password_hash":  "",
		"updated_at":     time.Now(),
	}).Error; err != nil {
		return err
	}
	return s.db.Delete(user).Error
}

func (s *UserService) ChangePassword(userID string, oldPassword, newPassword string) error {
	var user model.User
	if err := s.db.First(&user, "id = ?", userID).Error; err != nil {
		return err
	}
	if user.AuthProvider == "google" || user.AuthProvider == "wechat" {
		return errors.New("第三方登录账号无法修改密码")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(oldPassword)); err != nil {
		return errors.New("当前密码不正确")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.db.Model(&user).Updates(map[string]interface{}{
		"password_hash": string(hash),
		"updated_at":    time.Now(),
	}).Error
}
