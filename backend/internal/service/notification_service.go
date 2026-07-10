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
	Items  []NotificationView `json:"items"`
	Total  int64              `json:"total"`
	Unread int64              `json:"unread"`
}

// NotificationView enriches notifications with actor avatar and target title for list UI.
type NotificationView struct {
	model.Notification
	ActorAvatar string `json:"actor_avatar,omitempty"`
	TargetTitle string `json:"target_title,omitempty"`
}

func (s *NotificationService) List(userID string, limit, offset int, onlyUnread bool) (*NotificationList, error) {
	q := s.db.Model(&model.Notification{}).Where("user_id = ?", userID)
	if onlyUnread {
		q = q.Where("is_read = ?", false)
	}
	var items []model.Notification
	var total int64
	q.Count(&total)
	if err := q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&items).Error; err != nil {
		return nil, err
	}
	var unread int64
	s.db.Model(&model.Notification{}).Where("user_id = ? AND is_read = ?", userID, false).Count(&unread)
	return &NotificationList{Items: enrichNotifications(s.db, items), Total: total, Unread: unread}, nil
}

func enrichNotifications(db *gorm.DB, items []model.Notification) []NotificationView {
	if len(items) == 0 {
		return []NotificationView{}
	}
	userIDs := make(map[string]bool)
	agentIDs := make(map[string]bool)
	ideaIDs := make(map[string]bool)
	for _, n := range items {
		switch n.ActorType {
		case "agent":
			agentIDs[n.ActorID] = true
		default:
			userIDs[n.ActorID] = true
		}
		if n.TargetType == "idea" && n.TargetID != "" {
			ideaIDs[n.TargetID] = true
		}
	}
	avatarByID := map[string]string{}
	if len(userIDs) > 0 {
		ids := keys(userIDs)
		var rows []struct {
			ID        string
			AvatarURL string
		}
		db.Table("users").Select("id, avatar_url").Where("id IN ?", ids).Scan(&rows)
		for _, r := range rows {
			avatarByID[r.ID] = ResolveUserAvatar(r.ID, r.AvatarURL)
		}
	}
	if len(agentIDs) > 0 {
		ids := keys(agentIDs)
		var rows []struct {
			ID        string
			AvatarURL string
		}
		db.Table("agents").Select("id, avatar_url").Where("id IN ?", ids).Scan(&rows)
		for _, r := range rows {
			avatarByID[r.ID] = ResolveAgentAvatar(r.ID, r.AvatarURL)
		}
	}
	titleByIdeaID := map[string]string{}
	if len(ideaIDs) > 0 {
		ids := keys(ideaIDs)
		var rows []struct {
			ID    string
			Title string
		}
		db.Table("ideas").Select("id, title").Where("id IN ?", ids).Scan(&rows)
		for _, r := range rows {
			titleByIdeaID[r.ID] = r.Title
		}
	}
	out := make([]NotificationView, len(items))
	for i, n := range items {
		v := NotificationView{Notification: n, ActorAvatar: avatarByID[n.ActorID]}
		if n.TargetType == "idea" {
			v.TargetTitle = titleByIdeaID[n.TargetID]
		}
		out[i] = v
	}
	return out
}

func keys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func (s *NotificationService) UnreadCount(userID string) int64 {
	var n int64
	s.db.Model(&model.Notification{}).Where("user_id = ? AND is_read = ?", userID, false).Count(&n)
	return n
}

func (s *NotificationService) MarkRead(userID, id string) error {
	return s.db.Model(&model.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_read", true).Error
}

func (s *NotificationService) MarkAllRead(userID string) error {
	return s.db.Model(&model.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Update("is_read", true).Error
}
