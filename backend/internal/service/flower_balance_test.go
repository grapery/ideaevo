package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/model"
)

func seedFlowerActors(t *testing.T) (senderUserID, authorUserID, authorAgentID, ideaID string) {
	t.Helper()
	db := testDB(t)
	require.NoError(t, db.AutoMigrate(
		&model.Flower{},
		&model.FlowerDailyBalance{},
		&model.ActivityLog{},
		&model.Notification{},
	))

	suffix := uniqueSuffix()
	senderUserID = "usr-send-" + suffix
	authorUserID = "usr-auth-" + suffix
	authorAgentID = "agt-auth-" + suffix
	senderAgentID := "agt-send-" + suffix
	ideaID = "idea-fl-" + suffix

	require.NoError(t, db.Create(&model.User{ID: senderUserID, Name: "Sender", Email: senderUserID + "@t.local", AuthProvider: "email", Role: "user"}).Error)
	require.NoError(t, db.Create(&model.User{ID: authorUserID, Name: "Author", Email: authorUserID + "@t.local", AuthProvider: "email", Role: "user"}).Error)
	require.NoError(t, db.Create(&model.Agent{
		ID: authorAgentID, Name: "AuthorAgent", APIKeyHash: "h-a-" + suffix,
		Capabilities: "[]", OwnerUserID: authorUserID,
	}).Error)
	require.NoError(t, db.Create(&model.Agent{
		ID: senderAgentID, Name: "SenderAgent", APIKeyHash: "h-s-" + suffix,
		Capabilities: "[]", OwnerUserID: senderUserID,
	}).Error)
	require.NoError(t, db.Create(&model.Idea{
		ID: ideaID, AgentID: authorAgentID, Title: "Flower idea", Status: model.IdeaStatusActive,
	}).Error)
	return senderUserID, authorUserID, authorAgentID, ideaID
}

func TestSendFlowers_UsesDailyGrantAndCreditsAuthor(t *testing.T) {
	senderUserID, authorUserID, _, ideaID := seedFlowerActors(t)
	db := testDB(t)
	svc := NewSocialService(db)

	result, err := svc.SendFlowers(SendFlowersInput{IdeaID: ideaID, UserID: senderUserID})
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, model.FlowerDailyGrant-1, result.Available)

	senderBal, err := svc.GetFlowerBalance(senderUserID)
	require.NoError(t, err)
	assert.Equal(t, model.FlowerDailyGrant, senderBal.GrantQuota)
	assert.Equal(t, 1, senderBal.SpentToday)
	assert.Equal(t, 0, senderBal.ReceivedToday)
	assert.Equal(t, model.FlowerDailyGrant-1, senderBal.Available)
	assert.Equal(t, 0, senderBal.LifetimeReceived)

	authorBal, err := svc.GetFlowerBalance(authorUserID)
	require.NoError(t, err)
	assert.Equal(t, 1, authorBal.ReceivedToday)
	assert.Equal(t, model.FlowerDailyGrant+1, authorBal.Available)
	assert.Equal(t, 1, authorBal.LifetimeReceived)
	// Daily grant must not inflate received stats.
	assert.NotEqual(t, model.FlowerDailyGrant, authorBal.LifetimeReceived)
}

func TestSendFlowers_InsufficientBudget(t *testing.T) {
	senderUserID, _, _, ideaID := seedFlowerActors(t)
	db := testDB(t)
	svc := NewSocialService(db)

	require.NoError(t, db.Create(&model.FlowerDailyBalance{
		UserID:     senderUserID,
		Date:       flowerTodayString(),
		GrantQuota: model.FlowerDailyGrant,
		SpentToday: model.FlowerDailyGrant,
	}).Error)

	_, err := svc.SendFlowers(SendFlowersInput{IdeaID: ideaID, UserID: senderUserID})
	require.ErrorIs(t, err, ErrInsufficientFlowers)
}

func TestSendFlowers_ReceivedCanBeSpentSameDay(t *testing.T) {
	senderUserID, authorUserID, _, ideaID := seedFlowerActors(t)
	db := testDB(t)
	svc := NewSocialService(db)

	// Author receives one flower from sender.
	_, err := svc.SendFlowers(SendFlowersInput{IdeaID: ideaID, UserID: senderUserID})
	require.NoError(t, err)

	// Exhaust author's grant; remaining available should come only from received_today.
	require.NoError(t, db.Model(&model.FlowerDailyBalance{}).
		Where("user_id = ? AND date = ?", authorUserID, flowerTodayString()).
		Update("spent_today", model.FlowerDailyGrant).Error)

	authorBal, err := svc.GetFlowerBalance(authorUserID)
	require.NoError(t, err)
	assert.Equal(t, 1, authorBal.Available)
	assert.Equal(t, 1, authorBal.ReceivedToday)

	// Create another idea owned by sender so author can spend the received flower.
	suffix := uniqueSuffix()
	targetIdeaID := "idea-tgt-" + suffix
	senderAgentID := "agt-tgt-" + suffix
	require.NoError(t, db.Create(&model.Agent{
		ID: senderAgentID, Name: "T", APIKeyHash: "h-t-" + suffix,
		Capabilities: "[]", OwnerUserID: senderUserID,
	}).Error)
	require.NoError(t, db.Create(&model.Idea{
		ID: targetIdeaID, AgentID: senderAgentID, Title: "target", Status: model.IdeaStatusActive,
	}).Error)

	_, err = svc.SendFlowers(SendFlowersInput{IdeaID: targetIdeaID, UserID: authorUserID})
	require.NoError(t, err)

	authorBal, err = svc.GetFlowerBalance(authorUserID)
	require.NoError(t, err)
	assert.Equal(t, 0, authorBal.Available)
}

func TestSendFlowers_SelfSendDoesNotCreditReceived(t *testing.T) {
	_, authorUserID, authorAgentID, ideaID := seedFlowerActors(t)
	db := testDB(t)
	svc := NewSocialService(db)

	_, err := svc.SendFlowers(SendFlowersInput{IdeaID: ideaID, UserID: authorUserID})
	require.NoError(t, err)

	bal, err := svc.GetFlowerBalance(authorUserID)
	require.NoError(t, err)
	assert.Equal(t, 0, bal.ReceivedToday)
	assert.Equal(t, 0, bal.LifetimeReceived)
	assert.Equal(t, 1, bal.SpentToday)
	assert.Equal(t, model.FlowerDailyGrant-1, bal.Available)

	// Agent under same owner also does not credit self.
	_, err = svc.SendFlowers(SendFlowersInput{IdeaID: ideaID, AgentID: authorAgentID})
	require.NoError(t, err)
	bal, err = svc.GetFlowerBalance(authorUserID)
	require.NoError(t, err)
	assert.Equal(t, 0, bal.ReceivedToday)
	assert.Equal(t, 2, bal.SpentToday)
}

func TestSendFlowers_AgentSharesOwnerBudget(t *testing.T) {
	senderUserID, _, _, ideaID := seedFlowerActors(t)
	db := testDB(t)
	svc := NewSocialService(db)

	var senderAgentID string
	require.NoError(t, db.Model(&model.Agent{}).Where("owner_user_id = ?", senderUserID).Pluck("id", &senderAgentID).Error)
	require.NotEmpty(t, senderAgentID)

	_, err := svc.SendFlowers(SendFlowersInput{IdeaID: ideaID, AgentID: senderAgentID})
	require.NoError(t, err)

	bal, err := svc.GetFlowerBalance(senderUserID)
	require.NoError(t, err)
	assert.Equal(t, 1, bal.SpentToday)
	assert.Equal(t, model.FlowerDailyGrant-1, bal.Available)
}

func TestFlowerBalance_ExpiredReceivedNotInAvailable_AfterDateRollover(t *testing.T) {
	// Simulate: yesterday's received_today does not affect today's available.
	userID := "usr-roll-" + uniqueSuffix()
	db := testDB(t)
	require.NoError(t, db.AutoMigrate(&model.FlowerDailyBalance{}, &model.User{}, &model.Agent{}, &model.Idea{}, &model.Flower{}))
	require.NoError(t, db.Create(&model.User{ID: userID, Name: "U", Email: userID + "@t.local", AuthProvider: "email", Role: "user"}).Error)

	require.NoError(t, db.Create(&model.FlowerDailyBalance{
		UserID:        userID,
		Date:          "2000-01-01",
		GrantQuota:    model.FlowerDailyGrant,
		ReceivedToday: 50,
		SpentToday:    0,
	}).Error)

	svc := NewSocialService(db)
	bal, err := svc.GetFlowerBalance(userID)
	require.NoError(t, err)
	assert.Equal(t, flowerTodayString(), bal.Date)
	assert.Equal(t, 0, bal.ReceivedToday)
	assert.Equal(t, model.FlowerDailyGrant, bal.Available)
}
