package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/model"
)

func seedAgentSocialActors(t *testing.T) (ownerA, ownerB, agentA, agentB, userFollower string) {
	t.Helper()
	db := testDB(t)
	require.NoError(t, db.AutoMigrate(
		&model.AgentFollow{},
		&model.AgentPeerFollow{},
		&model.ActivityLog{},
		&model.Notification{},
		&model.Follow{},
	))

	suffix := uniqueSuffix()
	ownerA = "usr-a-" + suffix
	ownerB = "usr-b-" + suffix
	agentA = "agt-a-" + suffix
	agentB = "agt-b-" + suffix
	userFollower = "usr-f-" + suffix

	require.NoError(t, db.Create(&model.User{ID: ownerA, Name: "OwnerA", Email: ownerA + "@t.local", AuthProvider: "email", Role: "user"}).Error)
	require.NoError(t, db.Create(&model.User{ID: ownerB, Name: "OwnerB", Email: ownerB + "@t.local", AuthProvider: "email", Role: "user"}).Error)
	require.NoError(t, db.Create(&model.User{ID: userFollower, Name: "Fan", Email: userFollower + "@t.local", AuthProvider: "email", Role: "user"}).Error)
	require.NoError(t, db.Create(&model.Agent{
		ID: agentA, Name: "AgentA", APIKeyHash: "h-a-" + suffix,
		Capabilities: "[]", OwnerUserID: ownerA,
	}).Error)
	require.NoError(t, db.Create(&model.Agent{
		ID: agentB, Name: "AgentB", APIKeyHash: "h-b-" + suffix,
		Capabilities: "[]", OwnerUserID: ownerB,
	}).Error)
	return ownerA, ownerB, agentA, agentB, userFollower
}

func TestAgentPeerFollow_ListsAndActivity(t *testing.T) {
	_, _, agentA, agentB, userFollower := seedAgentSocialActors(t)
	db := testDB(t)
	notif := NewNotificationService(db)
	followSvc := NewFollowService(db, notif)
	agentSvc := NewAgentService(db)

	require.NoError(t, followSvc.AgentFollowAgent(agentA, agentB))
	require.Error(t, followSvc.AgentFollowAgent(agentA, agentB)) // duplicate
	require.NoError(t, followSvc.FollowAgent(userFollower, agentB))

	following, total, err := agentSvc.GetAgentFollowing(agentA, 20, 0)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, following, 1)
	assert.Equal(t, agentB, following[0].ID)

	users, userTotal, err := followSvc.GetAgentFollowers(agentB, 20, 0)
	require.NoError(t, err)
	assert.Equal(t, int64(1), userTotal)
	require.Len(t, users, 1)
	assert.Equal(t, userFollower, users[0].ID)

	peers, peerTotal, err := agentSvc.GetAgentPeerFollowers(agentB, 20, 0)
	require.NoError(t, err)
	assert.Equal(t, int64(1), peerTotal)
	require.Len(t, peers, 1)
	assert.Equal(t, agentA, peers[0].ID)

	agentSvc.PostAgentThought(agentA, "hello from A")
	logs, actTotal, err := agentSvc.ListAgentActivity(agentA, 20, 0)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, actTotal, int64(2)) // follow + thought
	foundThought := false
	foundFollow := false
	for _, a := range logs {
		if a.Action == "agent_thought" {
			foundThought = true
		}
		if a.Action == "follow" && a.TargetID == agentB {
			foundFollow = true
		}
	}
	assert.True(t, foundThought)
	assert.True(t, foundFollow)

	require.NoError(t, followSvc.AgentUnfollowAgent(agentA, agentB))
	following, total, err = agentSvc.GetAgentFollowing(agentA, 20, 0)
	require.NoError(t, err)
	assert.Equal(t, int64(0), total)
	assert.Empty(t, following)
}

func TestAgentSocialTools_Execute(t *testing.T) {
	_, _, agentA, agentB, _ := seedAgentSocialActors(t)
	db := testDB(t)
	notif := NewNotificationService(db)
	followSvc := NewFollowService(db, notif)
	agentSvc := NewAgentService(db)

	p := Principal{AgentID: agentA, Source: "test"}
	followTool := NewFollowAgentTool(followSvc)
	res, err := followTool.Execute(context.Background(), p, ToolInput{"agent_id": agentB})
	require.NoError(t, err)
	require.True(t, res.OK)

	listTool := NewListAgentFollowingTool(agentSvc)
	res, err = listTool.Execute(context.Background(), p, ToolInput{})
	require.NoError(t, err)
	require.True(t, res.OK)
	data := res.Data.(map[string]any)
	assert.Equal(t, int64(1), data["total"])

	actTool := NewPostAgentActivityTool(agentSvc)
	res, err = actTool.Execute(context.Background(), p, ToolInput{"content": "mcp thought"})
	require.NoError(t, err)
	require.True(t, res.OK)

	getAct := NewGetAgentActivityTool(agentSvc)
	res, err = getAct.Execute(context.Background(), p, ToolInput{"limit": float64(10)})
	require.NoError(t, err)
	require.True(t, res.OK)
}
