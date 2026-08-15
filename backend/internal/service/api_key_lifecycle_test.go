package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/model"
)

func TestAPIKey_RotateCreateAndRevoke(t *testing.T) {
	db := testDB(t)
	require.NoError(t, db.AutoMigrate(&model.Agent{}, &model.User{}))
	svc := NewAgentService(db)

	suffix := uniqueSuffix()
	ownerID := "usr-key-" + suffix
	require.NoError(t, db.Create(&model.User{
		ID: ownerID, Name: "Owner", Email: ownerID + "@t.local", AuthProvider: "email", Role: "user",
	}).Error)

	reg, err := svc.Register(RegisterAgentInput{
		Name: "KeyAgent-" + suffix, OwnerUserID: ownerID, Capabilities: []string{"search_ideas"},
	})
	require.NoError(t, err)
	agentID := reg.Agent.ID
	firstKey := reg.APIKey
	require.NotEmpty(t, firstKey)
	assert.Equal(t, "active", reg.Agent.APIKeyStatus)

	got, err := svc.ValidateAPIKey(firstKey)
	require.NoError(t, err)
	assert.Equal(t, agentID, got.ID)

	// Rotate = regenerate
	secondKey, err := svc.RotateAPIKey(ownerID, agentID)
	require.NoError(t, err)
	require.NotEqual(t, firstKey, secondKey)
	_, err = svc.ValidateAPIKey(firstKey)
	require.Error(t, err)
	got, err = svc.ValidateAPIKey(secondKey)
	require.NoError(t, err)
	assert.Equal(t, agentID, got.ID)

	var agent model.Agent
	require.NoError(t, db.First(&agent, "id = ?", agentID).Error)
	assert.Equal(t, "active", agent.APIKeyStatus)

	// Revoke = delete key (keep agent)
	require.NoError(t, svc.RevokeAPIKey(ownerID, agentID))
	_, err = svc.ValidateAPIKey(secondKey)
	require.Error(t, err)
	require.NoError(t, db.First(&agent, "id = ?", agentID).Error)
	assert.Equal(t, "revoked", agent.APIKeyStatus)

	// Create again after revoke via rotate
	thirdKey, err := svc.RotateAPIKey(ownerID, agentID)
	require.NoError(t, err)
	got, err = svc.ValidateAPIKey(thirdKey)
	require.NoError(t, err)
	assert.Equal(t, agentID, got.ID)
	require.NoError(t, db.First(&agent, "id = ?", agentID).Error)
	assert.Equal(t, "active", agent.APIKeyStatus)

	// Non-owner forbidden
	_, err = svc.RotateAPIKey("other-"+suffix, agentID)
	require.Error(t, err)
	err = svc.RevokeAPIKey("other-"+suffix, agentID)
	require.Error(t, err)
}
