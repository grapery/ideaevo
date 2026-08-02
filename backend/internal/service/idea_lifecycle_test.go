package service

import (
	"testing"
	"time"

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

	updated, err := svc.MarkImplemented(idea.ID, agentID, "demo live + docs")
	require.NoError(t, err)
	assert.Equal(t, model.IdeaStatusImplemented, updated.Status)
	require.NotNil(t, updated.ImplementedAt)
	assert.Equal(t, "demo live + docs", updated.ImplementedReason)
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

	_, err := svc.MarkImplemented(idea.ID, "agt-someone-else", "x")
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

// ---- 信誉分 ----

func TestUserReputation_BaselineAndGrowth(t *testing.T) {
	// 全新 user(刚注册、无关注):接近基线 0.3
	newUser := &model.User{FollowerCount: 0}
	newUser.CreatedAt = time.Now()
	assert.InDelta(t, 0.3, UserReputation(newUser), 0.01)

	// 老用户 + 高关注:接近上限 1.0
	oldUser := &model.User{FollowerCount: 200}
	oldUser.CreatedAt = time.Now().AddDate(-3, 0, 0)
	rep := UserReputation(oldUser)
	assert.True(t, rep > 0.95 && rep <= 1.0, "老用户高关注应接近 1.0, got %f", rep)
}

func TestAgentReputation_FallsBackToOwner(t *testing.T) {
	owner := &model.User{FollowerCount: 50}
	owner.CreatedAt = time.Now().AddDate(-1, 0, 0)
	agent := &model.Agent{OwnerUserID: "owner-1"}
	rep := AgentReputation(agent, owner)
	assert.Equal(t, UserReputation(owner), rep)

	// 系统 agent(无 owner):默认 0.5
	sysAgent := &model.Agent{}
	assert.InDelta(t, 0.5, AgentReputation(sysAgent, nil), 0.001)
}

// ---- 防刷:同 owner 去重 ----

// seedIdeaWithOwner 创建一个有 owner 的 agent + idea,用于防刷测试。
func seedIdeaWithOwner(t *testing.T) (*model.Idea, *model.User, *model.Agent) {
	t.Helper()
	db := testDB(t)
	userID := "usr-" + uniqueSuffix()
	agentID := "agt-" + uniqueSuffix()
	ideaID := "idea-" + uniqueSuffix()
	user := &model.User{ID: userID, Email: "e-" + userID + "@t.com", Name: "u", AuthProvider: "email"}
	agent := &model.Agent{ID: agentID, Name: "a", APIKeyHash: "h-" + uniqueSuffix(), Capabilities: "[]", OwnerUserID: userID}
	require.NoError(t, db.Create(user).Error)
	require.NoError(t, db.Create(agent).Error)
	require.NoError(t, db.Create(&model.Idea{ID: ideaID, AgentID: agentID, Title: "t", Status: model.IdeaStatusActive}).Error)
	var idea model.Idea
	require.NoError(t, db.First(&idea, "id = ?", ideaID).Error)
	return &idea, user, agent
}

func TestWishIdea_SameOwnerDifferentAgentRejected(t *testing.T) {
	idea, user, _ := seedIdeaWithOwner(t)
	db := testDB(t)
	svc := NewSocialService(db)

	// user 本人先 wish
	require.NoError(t, svc.WishIdea(idea.ID, user.ID, ""))

	// user 名下的另一个 agent 再 wish → 应被拒
	agent2ID := "agt2-" + uniqueSuffix()
	require.NoError(t, db.Create(&model.Agent{ID: agent2ID, Name: "a2", APIKeyHash: "h2-" + uniqueSuffix(), Capabilities: "[]", OwnerUserID: user.ID}).Error)
	err := svc.WishIdea(idea.ID, "", agent2ID)
	require.Error(t, err, "同一 owner 的另一个 agent wish 应被拒")

	// 计数应仍是 1
	var updated model.Idea
	require.NoError(t, db.First(&updated, "id = ?", idea.ID).Error)
	assert.Equal(t, 1, updated.WishCount)
}

func TestLikeIdea_SameOwnerUserAndAgentRejected(t *testing.T) {
	idea, user, agent := seedIdeaWithOwner(t)
	db := testDB(t)
	svc := NewSocialService(db)

	// user 名下 agent 先 like
	require.NoError(t, svc.LikeIdea(idea.ID, "", agent.ID))
	// user 本人再 like → 应被拒(同 owner)
	err := svc.LikeIdea(idea.ID, user.ID, "")
	require.Error(t, err, "agent 已 like 后,user 本人再 like 应被拒")
}

func TestWishIdea_WeightedScoreAccumulated(t *testing.T) {
	idea, user, _ := seedIdeaWithOwner(t)
	db := testDB(t)
	svc := NewSocialService(db)

	// wish 前 weighted_score 应为 0
	var before model.Idea
	require.NoError(t, db.First(&before, "id = ?", idea.ID).Error)
	assert.Equal(t, 0.0, before.WeightedScore)

	// user wish 后,weighted_score 应增加(>0,具体值取决于 user 信誉)
	require.NoError(t, svc.WishIdea(idea.ID, user.ID, ""))
	var after model.Idea
	require.NoError(t, db.First(&after, "id = ?", idea.ID).Error)
	assert.True(t, after.WeightedScore > 0, "wish 后 weighted_score 应 > 0, got %f", after.WeightedScore)
}

// ---- 时间窗榜单 ----

func TestRankingTrending_ReturnsActiveIdeasByScore(t *testing.T) {
	idea, user, _ := seedIdeaWithOwner(t)
	db := testDB(t)
	ideaSvc := NewIdeaService(db)
	socialSvc := NewSocialService(db)

	// 给 idea 投一票产生数据
	require.NoError(t, socialSvc.WishIdea(idea.ID, user.ID, ""))

	// 查本周 wish 榜(tiebreaker:同分按最新互动时间,确保刚投票的上榜)
	trending, err := ideaSvc.RankingTrending("week", "wish", 10)
	require.NoError(t, err)
	require.NotEmpty(t, trending, "投票后榜单不应为空")
	// 刚投过票的 idea 应在榜上
	found := false
	for _, ti := range trending {
		if ti.ID == idea.ID {
			found = true
			assert.True(t, ti.Score >= 1)
			break
		}
	}
	assert.True(t, found, "刚投票的 idea 应在榜单中")
}

func TestRankingTrending_WeightedMetricWorks(t *testing.T) {
	idea, user, _ := seedIdeaWithOwner(t)
	db := testDB(t)
	ideaSvc := NewIdeaService(db)
	socialSvc := NewSocialService(db)

	require.NoError(t, socialSvc.WishIdea(idea.ID, user.ID, ""))

	trending, err := ideaSvc.RankingTrending("week", "weighted", 10)
	require.NoError(t, err)
	require.NotEmpty(t, trending, "weighted 榜单不应为空")
}
