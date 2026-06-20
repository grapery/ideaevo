package service

import (
	"github.com/wanye/ideaevo/internal/model"
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
