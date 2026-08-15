package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNotificationPreferencesService_GetOrDefault(t *testing.T) {
	db := testDB(t)
	svc := NewNotificationPreferencesService(db)
	userID := "user-" + uniqueSuffix()

	prefs, err := svc.GetOrDefault(userID)
	require.NoError(t, err)
	assert.Equal(t, userID, prefs.UserID)
	assert.True(t, prefs.PushFlowers)
	assert.True(t, prefs.EmailOnFollow)
}

func TestNotificationPreferencesService_Update(t *testing.T) {
	db := testDB(t)
	svc := NewNotificationPreferencesService(db)
	userID := "user-" + uniqueSuffix()

	falseVal := false
	updated, err := svc.Update(userID, UpdateNotificationPreferencesInput{
		PushComments: &falseVal,
	})
	require.NoError(t, err)
	assert.False(t, updated.PushComments)
	assert.True(t, updated.PushFlowers)

	loaded, err := svc.GetOrDefault(userID)
	require.NoError(t, err)
	assert.False(t, loaded.PushComments)
}

func TestNotificationPreferencesService_RegisterDevice_Upsert(t *testing.T) {
	db := testDB(t)
	svc := NewNotificationPreferencesService(db)
	user1 := "user-" + uniqueSuffix()
	user2 := "user-" + uniqueSuffix()

	device, err := svc.RegisterDevice(user1, RegisterDeviceInput{Token: "tok-" + uniqueSuffix(), Platform: "ios"})
	require.NoError(t, err)
	assert.Equal(t, user1, device.UserID)

	moved, err := svc.RegisterDevice(user2, RegisterDeviceInput{Token: device.Token, Platform: "ios"})
	require.NoError(t, err)
	assert.Equal(t, user2, moved.UserID)
	assert.Equal(t, device.ID, moved.ID)
}
