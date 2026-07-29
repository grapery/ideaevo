package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/model"
)

func TestNotificationService_ListFiltersWindowAndEnrichesActor(t *testing.T) {
	db := testDB(t)
	require.NoError(t, db.AutoMigrate(&model.Notification{}))

	suffix := uniqueSuffix()
	ownerID := "notification-owner-" + suffix
	actor := &model.User{
		Name:         "notification-actor-" + suffix,
		Email:        "notification-" + suffix + "@example.com",
		AuthProvider: "email",
	}
	require.NoError(t, db.Create(actor).Error)

	recent := &model.Notification{
		UserID:     ownerID,
		ActorType:  "user",
		ActorID:    actor.ID,
		Action:     "wish",
		TargetType: "idea",
		TargetID:   "idea-" + suffix,
		CreatedAt:  time.Now().Add(-time.Hour),
	}
	old := &model.Notification{
		UserID:     ownerID,
		ActorType:  "user",
		ActorID:    actor.ID,
		Action:     "comment",
		TargetType: "idea",
		TargetID:   "idea-old-" + suffix,
		CreatedAt:  time.Now().Add(-8 * 24 * time.Hour),
	}
	require.NoError(t, db.Create(recent).Error)
	require.NoError(t, db.Create(old).Error)
	t.Cleanup(func() {
		db.Where("user_id = ?", ownerID).Delete(&model.Notification{})
		db.Delete(&model.User{}, actor.ID)
	})

	since := time.Now().Add(-7 * 24 * time.Hour)
	result, err := NewNotificationService(db).List(ownerID, 20, 0, false, &since)
	require.NoError(t, err)
	require.Len(t, result.Items, 1)
	assert.Equal(t, recent.ID, result.Items[0].ID)
	assert.Equal(t, actor.Name, result.Items[0].ActorName)
	assert.NotEmpty(t, result.Items[0].ActorAvatar)
	assert.EqualValues(t, 1, result.Total)
	assert.EqualValues(t, 1, result.Unread)
}
