package service

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/model"
)

// 回归: fork 去重从"同版本仅一次"放宽为"内容级防重",
// 否则 AI 变异引擎的迭代工作流(生成变体→fork→再生成)第二次就会被拒。
func TestForkIdea_AllowsVariantRefork_BlocksIdenticalContent(t *testing.T) {
	db := testDB(t)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.Agent{}, &model.Idea{}, &model.IdeaVersion{},
		&model.Fork{}, &model.ActivityLog{}, &model.Notification{},
		&model.NotificationPreferences{},
	))

	suffix := uniqueSuffix()
	userID := "usr-fk-" + suffix
	agentID := "agt-fk-" + suffix
	ideaID := "idea-fk-" + suffix

	require.NoError(t, db.Create(&model.User{ID: userID, Name: "Forker", Email: userID + "@t.local", AuthProvider: "email", Role: "user"}).Error)
	require.NoError(t, db.Create(&model.Agent{
		ID: agentID, Name: "ForkAgent", APIKeyHash: "h-" + suffix,
		Capabilities: "[]", OwnerUserID: userID,
	}).Error)
	source := &model.Idea{ID: ideaID, AgentID: agentID, Title: "Source idea", Description: "base", Status: model.IdeaStatusActive}
	require.NoError(t, db.Create(source).Error)
	require.NoError(t, AppendIdeaVersion(db, source, "初始版本"))

	svc := NewSocialService(db)

	// 第一次 fork
	first, err := svc.ForkIdea(ForkIdeaInput{IdeaID: ideaID, AgentID: agentID, Title: "Variant A", Description: "desc A"})
	require.NoError(t, err)

	// 同一版本、不同内容: 允许再次 fork(AI 变异迭代的关键路径)
	second, err := svc.ForkIdea(ForkIdeaInput{IdeaID: ideaID, AgentID: agentID, Title: "Variant B", Description: "desc B"})
	require.NoError(t, err)
	assert.NotEqual(t, first.ID, second.ID)

	// 与已有 fork 标题+描述完全一致: 拒绝(防误双击/重复提交)
	_, err = svc.ForkIdea(ForkIdeaInput{IdeaID: ideaID, AgentID: agentID, Title: "Variant A", Description: "desc A"})
	require.Error(t, err)
	assert.True(t, strings.HasPrefix(err.Error(), "duplicate fork content"), "unexpected error: %v", err)
}

// 回归: 源想法的作者 agent 无 owner(owner_user_id 为 NULL, 系统/自注册 agent)时,
// fork 链路的 EnsureIdeaInteraction/notifyIdeaOwner 等曾因 "converting NULL to
// string is unsupported" 扫描错误直接失败。
func TestForkIdea_AuthorAgentWithNullOwner(t *testing.T) {
	db := testDB(t)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.Agent{}, &model.Idea{}, &model.IdeaVersion{},
		&model.Fork{}, &model.ActivityLog{}, &model.Notification{},
		&model.NotificationPreferences{},
	))

	suffix := uniqueSuffix()
	forkerUserID := "usr-nf-" + suffix
	forkerAgentID := "agt-nf-" + suffix
	authorAgentID := "agt-na-" + suffix
	ideaID := "idea-nf-" + suffix

	require.NoError(t, db.Create(&model.User{ID: forkerUserID, Name: "Forker", Email: forkerUserID + "@t.local", AuthProvider: "email", Role: "user"}).Error)
	require.NoError(t, db.Create(&model.Agent{
		ID: forkerAgentID, Name: "ForkAgent", APIKeyHash: "h-" + suffix,
		Capabilities: "[]", OwnerUserID: forkerUserID,
	}).Error)
	require.NoError(t, db.Create(&model.Agent{
		ID: authorAgentID, Name: "SystemAgent", APIKeyHash: "h-na-" + suffix,
		Capabilities: "[]",
	}).Error)
	// 模拟历史行: owner_user_id 为 NULL 而非 ''
	db.Exec("UPDATE agents SET owner_user_id = NULL WHERE id = ?", authorAgentID)

	source := &model.Idea{ID: ideaID, AgentID: authorAgentID, Title: "System idea", Description: "base", Status: model.IdeaStatusActive}
	require.NoError(t, db.Create(source).Error)
	require.NoError(t, AppendIdeaVersion(db, source, "初始版本"))

	svc := NewSocialService(db)
	idea, err := svc.ForkIdea(ForkIdeaInput{IdeaID: ideaID, AgentID: forkerAgentID, Title: "My variant", Description: "changed"})
	require.NoError(t, err)
	assert.NotEmpty(t, idea.ID)
}
