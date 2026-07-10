package service

import (
	"fmt"
	"strings"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type NotificationPreferencesService struct {
	db *gorm.DB
}

func NewNotificationPreferencesService(db *gorm.DB) *NotificationPreferencesService {
	return &NotificationPreferencesService{db: db}
}

type UpdateNotificationPreferencesInput struct {
	PushFlowers       *bool `json:"push_flowers"`
	PushComments      *bool `json:"push_comments"`
	PushFollows       *bool `json:"push_follows"`
	PushEnabled       *bool `json:"push_enabled"`
	EmailOnFollow     *bool `json:"email_on_follow"`
	EmailOnComment    *bool `json:"email_on_comment"`
	EmailOnFlower     *bool `json:"email_on_flower"`
	EmailOnMention    *bool `json:"email_on_mention"`
	EmailWeeklyDigest *bool `json:"email_weekly_digest"`
}

func (s *NotificationPreferencesService) GetOrDefault(userID string) (model.NotificationPreferences, error) {
	var prefs model.NotificationPreferences
	err := s.db.Where("user_id = ?", userID).First(&prefs).Error
	if err == nil {
		return prefs, nil
	}
	if err == gorm.ErrRecordNotFound {
		return model.DefaultNotificationPreferences(userID), nil
	}
	return model.NotificationPreferences{}, err
}

func (s *NotificationPreferencesService) Update(userID string, input UpdateNotificationPreferencesInput) (model.NotificationPreferences, error) {
	prefs, err := s.GetOrDefault(userID)
	if err != nil {
		return model.NotificationPreferences{}, err
	}
	prefs.UserID = userID

	if input.PushFlowers != nil {
		prefs.PushFlowers = *input.PushFlowers
	}
	if input.PushComments != nil {
		prefs.PushComments = *input.PushComments
	}
	if input.PushFollows != nil {
		prefs.PushFollows = *input.PushFollows
	}
	if input.PushEnabled != nil {
		prefs.PushEnabled = *input.PushEnabled
	}
	if input.EmailOnFollow != nil {
		prefs.EmailOnFollow = *input.EmailOnFollow
	}
	if input.EmailOnComment != nil {
		prefs.EmailOnComment = *input.EmailOnComment
	}
	if input.EmailOnFlower != nil {
		prefs.EmailOnFlower = *input.EmailOnFlower
	}
	if input.EmailOnMention != nil {
		prefs.EmailOnMention = *input.EmailOnMention
	}
	if input.EmailWeeklyDigest != nil {
		prefs.EmailWeeklyDigest = *input.EmailWeeklyDigest
	}

	record := map[string]interface{}{
		"user_id":             userID,
		"push_flowers":        prefs.PushFlowers,
		"push_comments":       prefs.PushComments,
		"push_follows":        prefs.PushFollows,
		"push_enabled":        prefs.PushEnabled,
		"email_on_follow":     prefs.EmailOnFollow,
		"email_on_comment":    prefs.EmailOnComment,
		"email_on_flower":     prefs.EmailOnFlower,
		"email_on_mention":    prefs.EmailOnMention,
		"email_weekly_digest": prefs.EmailWeeklyDigest,
	}
	if err := s.db.Model(&model.NotificationPreferences{}).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"push_flowers":        prefs.PushFlowers,
			"push_comments":       prefs.PushComments,
			"push_follows":        prefs.PushFollows,
			"push_enabled":        prefs.PushEnabled,
			"email_on_follow":     prefs.EmailOnFollow,
			"email_on_comment":    prefs.EmailOnComment,
			"email_on_flower":     prefs.EmailOnFlower,
			"email_on_mention":    prefs.EmailOnMention,
			"email_weekly_digest": prefs.EmailWeeklyDigest,
		}),
	}).Create(record).Error; err != nil {
		return model.NotificationPreferences{}, err
	}
	return s.GetOrDefault(userID)
}

type RegisterDeviceInput struct {
	Token    string `json:"token" binding:"required"`
	Platform string `json:"platform"`
}

func (s *NotificationPreferencesService) RegisterDevice(userID string, input RegisterDeviceInput) (*model.UserDevice, error) {
	token := strings.TrimSpace(input.Token)
	if token == "" {
		return nil, fmt.Errorf("token is required")
	}
	platform := strings.TrimSpace(input.Platform)
	if platform == "" {
		platform = "ios"
	}

	var device model.UserDevice
	err := s.db.Where("token = ?", token).First(&device).Error
	if err == nil {
		device.UserID = userID
		device.Platform = platform
		if err := s.db.Save(&device).Error; err != nil {
			return nil, err
		}
		return &device, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	device = model.UserDevice{
		UserID:   userID,
		Token:    token,
		Platform: platform,
	}
	if err := s.db.Create(&device).Error; err != nil {
		return nil, err
	}
	return &device, nil
}

func (s *NotificationPreferencesService) DeleteDevice(userID, deviceID string) error {
	result := s.db.Where("id = ? AND user_id = ?", deviceID, userID).Delete(&model.UserDevice{})
	if result.RowsAffected == 0 {
		return fmt.Errorf("device not found")
	}
	return nil
}
