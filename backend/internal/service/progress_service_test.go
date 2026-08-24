package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// progressTestDB 在共享 testDB 基础上补齐本文件用到的表。
func progressTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := testDB(t)
	require.NoError(t, db.AutoMigrate(&model.IdeaProgressItem{}, &model.IdeaChangelog{}))
	return db
}

func seedIdeaForProgress(t *testing.T) (*model.Idea, string) {
	t.Helper()
	db := progressTestDB(t)
	agentID := "agt-" + uniqueSuffix()
	ideaID := "idea-" + uniqueSuffix()
	require.NoError(t, db.Create(&model.Agent{ID: agentID, Name: "n", APIKeyHash: "h-" + uniqueSuffix(), Capabilities: "[]"}).Error)
	require.NoError(t, db.Create(&model.Idea{ID: ideaID, AgentID: agentID, Title: "t", Status: model.IdeaStatusActive}).Error)
	var idea model.Idea
	require.NoError(t, db.First(&idea, "id = ?", ideaID).Error)
	return &idea, agentID
}

func progressEvents(t *testing.T, ideaID string) []model.IdeaChangelog {
	t.Helper()
	var rows []model.IdeaChangelog
	require.NoError(t, progressTestDB(t).Where("idea_id = ? AND type = ?", ideaID, ChangelogTypeProgress).Find(&rows).Error)
	return rows
}

func TestProgressService_AddItems_BumpsImplStatusAndLists(t *testing.T) {
	idea, _ := seedIdeaForProgress(t)
	svc := NewProgressService(progressTestDB(t))
	actor := ProgressActor{Type: "agent", ID: "agt-x", Name: "X"}

	view, err := svc.UpsertItems(idea.ID, []ProgressItemUpsert{
		{Input: ProgressItemInput{Content: "设计数据库表", Status: ProgressStatusTodo}},
		{Input: ProgressItemInput{Content: "打通登录", Status: ProgressStatusDone, CommitSHA: "abc1234"}},
	}, actor)
	require.NoError(t, err)
	require.Len(t, view.Todos, 1)
	require.Len(t, view.Dones, 1)
	require.NotNil(t, view.Dones[0].DoneAt)

	// 首次录入：concept → in_progress
	var updated model.Idea
	require.NoError(t, testDB(t).First(&updated, "id = ?", idea.ID).Error)
	assert.Equal(t, model.ImplStatusInProgress, updated.ImplStatus)

	// done 条目写了一条 progress 事件，SourceID=条目 ID
	events := progressEvents(t, idea.ID)
	require.Len(t, events, 1)
	assert.Equal(t, view.Dones[0].ID, events[0].SourceID)
	assert.Equal(t, "打通登录", events[0].Title)
	assert.Contains(t, events[0].Detail, "abc1234")
}

func TestProgressService_ToggleDone_RecyclesChangelogEvent(t *testing.T) {
	idea, _ := seedIdeaForProgress(t)
	db := progressTestDB(t)
	svc := NewProgressService(db)
	actor := ProgressActor{Type: "user", ID: "u-1"}

	view, err := svc.UpsertItems(idea.ID, []ProgressItemUpsert{
		{Input: ProgressItemInput{Content: "写单测"}},
	}, actor)
	require.NoError(t, err)
	require.Len(t, view.Todos, 1)
	itemID := view.Todos[0].ID

	// todo → done：写事件
	todo := ProgressStatusTodo
	done := ProgressStatusDone
	updated, err := svc.UpdateItem(idea.ID, itemID, ProgressUpdateInput{Status: &done}, actor)
	require.NoError(t, err)
	assert.Equal(t, ProgressStatusDone, updated.Status)
	require.Len(t, progressEvents(t, idea.ID), 1)

	// done → todo：按 SourceID 回收事件
	updated, err = svc.UpdateItem(idea.ID, itemID, ProgressUpdateInput{Status: &todo}, actor)
	require.NoError(t, err)
	assert.Equal(t, ProgressStatusTodo, updated.Status)
	assert.Empty(t, progressEvents(t, idea.ID))

	// 保持 done 的内容编辑不重复写事件
	_, err = svc.UpdateItem(idea.ID, itemID, ProgressUpdateInput{Status: &done}, actor)
	require.NoError(t, err)
	require.Len(t, progressEvents(t, idea.ID), 1)
	content := "写单测（含边界）"
	_, err = svc.UpdateItem(idea.ID, itemID, ProgressUpdateInput{Content: &content}, actor)
	require.NoError(t, err)
	assert.Len(t, progressEvents(t, idea.ID), 1)
}

func TestProgressService_UpsertUpdateKeepsStatus(t *testing.T) {
	idea, _ := seedIdeaForProgress(t)
	svc := NewProgressService(progressTestDB(t))
	actor := ProgressActor{Type: "agent", ID: "a"}

	view, err := svc.UpsertItems(idea.ID, []ProgressItemUpsert{
		{Input: ProgressItemInput{Content: "调研竞品"}},
	}, actor)
	require.NoError(t, err)
	itemID := view.Todos[0].ID

	// 带 id 更新但未传 status：保持 todo，不被重置
	view, err = svc.UpsertItems(idea.ID, []ProgressItemUpsert{
		{ID: itemID, Input: ProgressItemInput{Content: "调研竞品（已完成 3 家）"}},
	}, actor)
	require.NoError(t, err)
	require.Len(t, view.Todos, 1)
	assert.Equal(t, "调研竞品（已完成 3 家）", view.Todos[0].Content)
	assert.Empty(t, view.Dones)
}

func TestProgressService_Validation(t *testing.T) {
	idea, _ := seedIdeaForProgress(t)
	svc := NewProgressService(progressTestDB(t))
	actor := ProgressActor{Type: "user", ID: "u"}

	_, err := svc.UpsertItems(idea.ID, []ProgressItemUpsert{{Input: ProgressItemInput{Content: "   "}}}, actor)
	assert.ErrorContains(t, err, "content")

	_, err = svc.UpsertItems(idea.ID, []ProgressItemUpsert{
		{Input: ProgressItemInput{Content: "x", CommitSHA: "zzz"}},
	}, actor)
	assert.ErrorContains(t, err, "commit_sha")

	bad := "ftp://x"
	_, err = svc.UpsertItems(idea.ID, []ProgressItemUpsert{
		{Input: ProgressItemInput{Content: "x", LinkURL: bad}},
	}, actor)
	assert.Error(t, err)

	_, err = svc.UpsertItems(idea.ID, nil, actor)
	assert.ErrorContains(t, err, "items")
}

func TestProgressService_DeleteRemovesEvents(t *testing.T) {
	idea, _ := seedIdeaForProgress(t)
	db := progressTestDB(t)
	svc := NewProgressService(db)
	actor := ProgressActor{Type: "user", ID: "u"}

	view, err := svc.UpsertItems(idea.ID, []ProgressItemUpsert{
		{Input: ProgressItemInput{Content: "上线", Status: ProgressStatusDone}},
	}, actor)
	require.NoError(t, err)
	itemID := view.Dones[0].ID
	require.Len(t, progressEvents(t, idea.ID), 1)

	require.NoError(t, svc.DeleteItem(idea.ID, itemID))
	assert.Empty(t, progressEvents(t, idea.ID))

	got, err := svc.List(idea.ID)
	require.NoError(t, err)
	assert.Empty(t, got.Todos)
	assert.Empty(t, got.Dones)
}
