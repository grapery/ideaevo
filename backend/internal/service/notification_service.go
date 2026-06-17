package service

import (
	"errors"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type NotificationService struct {
	db *gorm.DB
}

func NewNotificationService(db *gorm.DB) *NotificationService {
	return &NotificationService{db: db}
}

// Create records a notification for the target user. It is a no-op if the
// notification would target its own actor (e.g. user liking own idea).
func (s *NotificationService) Create(
	userID, actorType, actorID, actorName, action, targetType, targetID, summary string,
) error {
	if userID == "" || userID == actorID {
		return nil
	}
	n := &model.Notification{
		UserID:     userID,
		ActorType:  actorType,
		ActorID:    actorID,
		ActorName:  actorName,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Summary:    summary,
	}
	return s.db.Create(n).Error
}

type NotificationList struct {
	Items  []model.Notification `json:"items"`
	Total  int64                `json:"total"`
	Unread int64                `json:"unread"`
}

func (s *NotificationService) List(userID string, limit, offset int, onlyUnread bool) (*NotificationList, error) {
	q := s.db.Model(&model.Notification{}).Where("user_id = ?", userID)
	if onlyUnread {
		q = q.Where("read = ?", false)
	}
	var items []model.Notification
	var total int64
	q.Count(&total)
	if err := q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&items).Error; err != nil {
		return nil, err
	}
	var unread int64
	s.db.Model(&model.Notification{}).Where("user_id = ? AND read = ?", userID, false).Count(&unread)
	return &NotificationList{Items: items, Total: total, Unread: unread}, nil
}

func (s *NotificationService) UnreadCount(userID string) int64 {
	var n int64
	s.db.Model(&model.Notification{}).Where("user_id = ? AND read = ?", userID, false).Count(&n)
	return n
}

func (s *NotificationService) MarkRead(userID, id string) error {
	return s.db.Model(&model.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("read", true).Error
}

func (s *NotificationService) MarkAllRead(userID string) error {
	return s.db.Model(&model.Notification{}).
		Where("user_id = ? AND read = ?", userID, false).
		Update("read", true).Error
}

type UpdateProfileInput struct {
	Name         string   `json:"name" binding:"omitempty,min=1,max=64"`
	AvatarURL    string   `json:"avatar_url" binding:"omitempty,url"`
}

type ChangePasswordInput struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

// ---- Delegated user mutations (kept here so a single NotificationService can
// be wired into the settings handler) ----

func (s *NotificationService) UpdateProfile(userID string, input UpdateProfileInput) error {
	updates := map[string]interface{}{}
	if input.Name != "" {
		updates["name"] = input.Name
	}
	if input.AvatarURL != "" {
		updates["avatar_url"] = input.AvatarURL
	}
	if len(updates) == 0 {
		return nil
	}
	updates["updated_at"] = time.Now()
	return s.db.Model(&model.User{}).Where("id = ?", userID).Updates(updates).Error
}

func (s *NotificationService) ChangePassword(userID string, input ChangePasswordInput) error {
	var user model.User
	if err := s.db.First(&user, "id = ?", userID).Error; err != nil {
		return err
	}
	if user.AuthProvider == "google" {
		return errors.New("google accounts have no password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.OldPassword)); err != nil {
		return errors.New("incorrect current password")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	user.PasswordHash = string(hash)
	user.UpdatedAt = time.Now()
	return s.db.Save(&user).Error
}
