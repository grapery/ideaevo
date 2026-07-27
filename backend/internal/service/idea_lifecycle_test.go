package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/model"
)

// seedIdeaForLifecycle 创建一个 agent + active idea,返回 idea 与 agentID。
func seedIdeaForLifecycle(t *testing.T) (*model.Idea, string) {
	t.Helper()
	db := testDB(t)
	agentID := "agt-" + uniqueSuffix()
	ideaID := "idea-" + uniqueSuffix()
	require.NoError(t, db.Create(&model.Agent{ID: agentID, Name: "n", APIKeyHash: "h-" + uniqueSuffix(), Capabilities: "[]"}).Error)
	require.NoError(t, db.Create(&model.Idea{ID: ideaID, AgentID: agentID, Title: "t", Status: model.IdeaStatusActive}).Error)
	var idea model.Idea
	require.NoError(t, db.First(&idea, "id = ?", ideaID).Error)
	return &idea, agentID
}

// ---- 状态流转 ----

func TestIdeaService_Archive_SetsStatusAndTimestamp(t *testing.T) {
	idea, agentID := seedIdeaForLifecycle(t)
	svc := NewIdeaService(testDB(t))

	updated, err := svc.Archive(idea.ID, agentID, "暂无精力")
	require.NoError(t, err)
	assert.Equal(t, model.IdeaStatusArchived, updated.Status)
	require.NotNil(t, updated.ArchivedAt)
	assert.Equal(t, "暂无精力", updated.ArchivedReason)
}

func TestIdeaService_MarkImplemented_SetsStatusAndTimestamp(t *testing.T) {
	idea, agentID := seedIdeaForLifecycle(t)
	svc := NewIdeaService(testDB(t))

	updated, err := svc.MarkImplemented(idea.ID, agentID)
	require.NoError(t, err)
	assert.Equal(t, model.IdeaStatusImplemented, updated.Status)
	require.NotNil(t, updated.ImplementedAt)
}

func TestIdeaService_Reactivate_RestoresActive(t *testing.T) {
	idea, agentID := seedIdeaForLifecycle(t)
	db := testDB(t)
	svc := NewIdeaService(db)

	// 先归档
	_, err := svc.Archive(idea.ID, agentID, "")
	require.NoError(t, err)
	// 再重新激活
	updated, err := svc.Reactivate(idea.ID, agentID)
	require.NoError(t, err)
	assert.Equal(t, model.IdeaStatusActive, updated.Status)
}

func TestIdeaService_Archive_RejectsNonAuthor(t *testing.T) {
	idea, _ := seedIdeaForLifecycle(t)
	svc := NewIdeaService(testDB(t))

	// 非作者 agentID → 应失败
	_, err := svc.Archive(idea.ID, "agt-someone-else", "")
	require.Error(t, err)
}

func TestIdeaService_MarkImplemented_RejectsNonAuthor(t *testing.T) {
	idea, _ := seedIdeaForLifecycle(t)
	svc := NewIdeaService(testDB(t))

	_, err := svc.MarkImplemented(idea.ID, "agt-someone-else")
	require.Error(t, err)
}

// ---- Wish 信号 ----

func TestSocialService_WishIdea_IncrementsCount(t *testing.T) {
	idea, agentID := seedIdeaForLifecycle(t)
	db := testDB(t)
	svc := NewSocialService(db)

	require.NoError(t, svc.WishIdea(idea.ID, "", agentID))

	var updated model.Idea
	require.NoError(t, db.First(&updated, "id = ?", idea.ID).Error)
	assert.Equal(t, 1, updated.WishCount)
	assert.True(t, svc.HasWishedIdea(idea.ID, "", agentID))
}

func TestSocialService_UnwishIdea_DecrementsCount(t *testing.T) {
	idea, agentID := seedIdeaForLifecycle(t)
	db := testDB(t)
	svc := NewSocialService(db)

	require.NoError(t, svc.WishIdea(idea.ID, "", agentID))
	require.NoError(t, svc.UnwishIdea(idea.ID, "", agentID))

	var updated model.Idea
	require.NoError(t, db.First(&updated, "id = ?", idea.ID).Error)
	assert.Equal(t, 0, updated.WishCount)
	assert.False(t, svc.HasWishedIdea(idea.ID, "", agentID))
}

func TestSocialService_WishIdea_DuplicateRejected(t *testing.T) {
	idea, agentID := seedIdeaForLifecycle(t)
	svc := NewSocialService(testDB(t))

	require.NoError(t, svc.WishIdea(idea.ID, "", agentID))
	// 同一 agent 重复 wish → 唯一约束报错,且计数不翻倍
	err := svc.WishIdea(idea.ID, "", agentID)
	require.Error(t, err)
}

func TestSocialService_UnwishIdea_CountNotNegative(t *testing.T) {
	idea, agentID := seedIdeaForLifecycle(t)
	db := testDB(t)
	svc := NewSocialService(db)

	// 没有 wish 过直接 unwish → 不报错,计数保持 0(GREATEST 防负)
	require.NoError(t, svc.UnwishIdea(idea.ID, "", agentID))

	var updated model.Idea
	require.NoError(t, db.First(&updated, "id = ?", idea.ID).Error)
	assert.Equal(t, 0, updated.WishCount)
}
