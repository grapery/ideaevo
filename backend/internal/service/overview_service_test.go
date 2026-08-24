package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/model"
)

func seedForOverview(t *testing.T) (agent *model.Agent, ownerUserID string) {
	t.Helper()
	db := progressTestDB(t)
	ownerUserID = "usr-" + uniqueSuffix()
	agentID := "agt-" + uniqueSuffix()
	require.NoError(t, db.Create(&model.User{ID: ownerUserID, Name: "owner", Email: "o-" + uniqueSuffix() + "@t.dev"}).Error)
	require.NoError(t, db.Create(&model.Agent{ID: agentID, Name: "n", APIKeyHash: "h-" + uniqueSuffix(), Capabilities: "[]", OwnerUserID: ownerUserID}).Error)
	require.NoError(t, db.Create(&model.Idea{ID: "idea-" + uniqueSuffix(), AgentID: agentID, Title: "t", Status: model.IdeaStatusActive}).Error)
	var a model.Agent
	require.NoError(t, db.First(&a, "id = ?", agentID).Error)
	return &a, ownerUserID
}

func TestOverviewService_OwnerOverviewAggregatesProgress(t *testing.T) {
	agent, ownerUserID := seedForOverview(t)
	db := progressTestDB(t)
	ideaID := "idea-" + uniqueSuffix()
	require.NoError(t, db.Create(&model.Idea{ID: ideaID, AgentID: agent.ID, Title: "有进度的想法", Status: model.IdeaStatusActive, ImplStatus: model.ImplStatusInProgress}).Error)

	psvc := NewProgressService(db)
	_, err := psvc.UpsertItems(ideaID, []ProgressItemUpsert{
		{Input: ProgressItemInput{Content: "a", Status: ProgressStatusTodo}},
		{Input: ProgressItemInput{Content: "b", Status: ProgressStatusTodo}},
		{Input: ProgressItemInput{Content: "c", Status: ProgressStatusDone}},
	}, ProgressActor{Type: "agent", ID: agent.ID})
	require.NoError(t, err)

	ov, err := NewOverviewService(db).OwnerOverview(ownerUserID)
	require.NoError(t, err)
	assert.NotEmpty(t, ov.Ideas)
	found := false
	for _, s := range ov.Ideas {
		if s.IdeaID == ideaID {
			found = true
			assert.Equal(t, 2, s.Todos)
			assert.Equal(t, 1, s.Dones)
			assert.Equal(t, string(model.ImplStatusInProgress), s.ImplStatus)
			assert.NotNil(t, s.LastProgressAt)
		}
	}
	assert.True(t, found, "新 idea 应出现在总览里")
}

func TestAgentSignalService_RecentForAgent(t *testing.T) {
	agent, _ := seedForOverview(t)
	db := progressTestDB(t)
	ideaID := "idea-" + uniqueSuffix()
	require.NoError(t, db.Create(&model.Idea{ID: ideaID, AgentID: agent.ID, Title: "被关注的想法", Status: model.IdeaStatusActive}).Error)

	otherUser := "usr-" + uniqueSuffix()
	require.NoError(t, db.Create(&model.User{ID: otherUser, Name: "路人甲", Email: "p-" + uniqueSuffix() + "@t.dev"}).Error)
	require.NoError(t, db.Create(&model.Wish{IdeaID: ideaID, UserID: otherUser}).Error)
	require.NoError(t, db.Create(&model.Flower{IdeaID: ideaID, UserID: otherUser, Message: "加油"}).Error)
	require.NoError(t, db.Create(&model.Comment{IdeaID: ideaID, UserID: otherUser, Content: "期待"}).Error)
	require.NoError(t, db.Create(&model.AgentFollow{UserID: otherUser, AgentID: agent.ID}).Error)

	signals, err := NewAgentSignalService(db).RecentForAgent(agent.ID, 10)
	require.NoError(t, err)
	kinds := map[string]bool{}
	for _, s := range signals {
		kinds[s.Kind] = true
		assert.Equal(t, "路人甲", s.ActorName, "actor 名字应被解析")
	}
	assert.True(t, kinds["wish"])
	assert.True(t, kinds["flower"])
	assert.True(t, kinds["comment"])
	assert.True(t, kinds["follower"])
	// 时间倒序
	for i := 1; i < len(signals); i++ {
		assert.False(t, signals[i].At.After(signals[i-1].At), "信号应按时间倒序")
	}
}
