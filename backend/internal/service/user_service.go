package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserService struct {
	db     *gorm.DB
	email  *EmailService
	frontendURL string
}

func NewUserService(db *gorm.DB, email *EmailService, frontendURL string) *UserService {
	return &UserService{db: db, email: email, frontendURL: frontendURL}
}

type RegisterInput struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

func (s *UserService) Register(input RegisterInput) (*model.User, error) {
	var existing model.User
	if err := s.db.Where("email = ?", input.Email).First(&existing).Error; err == nil {
		return nil, errors.New("email already registered")
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

	_ = s.email.SendVerificationEmail(user.Email, token, s.frontendURL)
	return user, nil
}

func (s *UserService) VerifyEmail(token string) error {
	var user model.User
	if err := s.db.Where("email_verify_token = ?", token).First(&user).Error; err != nil {
		return errors.New("invalid token")
	}
	return s.db.Model(&user).Updates(map[string]interface{}{
		"email_verified":      true,
		"email_verify_token":  "",
	}).Error
}

func (s *UserService) LoginEmail(email, password string) (*model.User, error) {
	var user model.User
	if err := s.db.Where("email = ? AND auth_provider = ?", email, "email").First(&user).Error; err != nil {
		return nil, errors.New("invalid credentials")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid credentials")
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
		"password_reset_token":   token,
		"password_reset_expiry":  expiry,
	}).Error; err != nil {
		return err
	}

	_ = s.email.SendPasswordResetEmail(user.Email, token, s.frontendURL)
	return nil
}

func (s *UserService) ResetPassword(token, newPassword string) error {
	var user model.User
	if err := s.db.Where("password_reset_token = ?", token).First(&user).Error; err != nil {
		return errors.New("invalid token")
	}
	if user.PasswordResetExpiry == nil || user.PasswordResetExpiry.Before(time.Now()) {
		return errors.New("token expired")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	return s.db.Model(&user).Updates(map[string]interface{}{
		"password_hash":          string(hash),
		"password_reset_token":   "",
		"password_reset_expiry":  nil,
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
		return nil, errors.New("email already registered with password login")
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
		EmailVerified:  true,
	}
	if err := s.db.Create(&user).Error; err != nil {
		return nil, err
	}
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
	User           model.User `json:"user"`
	IdeaCount      int64      `json:"idea_count"`
	SessionCount   int64      `json:"session_count"`
	FollowerCount  int        `json:"follower_count"`
	FollowingCount int        `json:"following_count"`
}

func (s *UserService) GetProfile(userID string) (*UserProfile, error) {
	user, err := s.GetByID(userID)
	if err != nil {
		return nil, err
	}

	var ideaCount, sessionCount int64
	s.db.Model(&model.Idea{}).Where("agent_id IN (SELECT id FROM agents)", userID).Count(&ideaCount)
	s.db.Model(&model.ChatSession{}).Where("user_id = ?", userID).Count(&sessionCount)

	return &UserProfile{
		User:           *user,
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

func (s *UserService) UpdateAvatar(userID, avatarURL string) error {
	return s.db.Model(&model.User{}).Where("id = ?", userID).Update("avatar_url", avatarURL).Error
}
