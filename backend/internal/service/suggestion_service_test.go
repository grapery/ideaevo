package service

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/model"
)

// newSuggestionFixture 建 owner(user+agent) + idea，并迁移建议相关表。
func newSuggestionFixture(t *testing.T) (*SuggestionService, string, string) {
	t.Helper()
	db := testDB(t)
	require.NoError(t, db.AutoMigrate(&model.IdeaSuggestion{}, &model.SuggestionVote{}, &model.ImplementationJob{}))
	svc := NewSuggestionService(db)

	suffix := uniqueSuffix()
	ownerID := "owner-" + suffix
	agentID := "agent-" + suffix
	ideaID := "idea-" + suffix
	require.NoError(t, db.Create(&model.User{ID: ownerID, Email: "o" + suffix + "@t.dev", Name: "owner"}).Error)
	require.NoError(t, db.Create(&model.Agent{ID: agentID, OwnerUserID: ownerID, Name: "a", APIKeyHash: "hash-" + suffix, Capabilities: "[]"}).Error)
	require.NoError(t, db.Create(&model.Idea{ID: ideaID, AgentID: agentID, Title: "t", Status: "active", ImplStatus: model.ImplStatusConcept}).Error)
	return svc, ideaID, ownerID
}

func TestSuggestionService_CreateAndList(t *testing.T) {
	svc, ideaID, _ := newSuggestionFixture(t)

	sug, err := svc.Create(CreateSuggestionInput{IdeaID: ideaID, UserID: "u1", Content: "  建议支持暗色模式  "})
	require.NoError(t, err)
	assert.Equal(t, "建议支持暗色模式", sug.Content)

	// 空内容拒绝
	_, err = svc.Create(CreateSuggestionInput{IdeaID: ideaID, UserID: "u1", Content: "   "})
	assert.Error(t, err)

	// buried idea 拒绝（服务层统一校验，MCP 工具路径也覆盖）
	require.NoError(t, svc.db.Model(&model.Idea{}).Where("id = ?", ideaID).UpdateColumn("status", "buried").Error)
	_, err = svc.Create(CreateSuggestionInput{IdeaID: ideaID, UserID: "u1", Content: "x"})
	assert.ErrorIs(t, err, ErrSuggestionIdeaGone)

	// 不存在的 idea 拒绝
	_, err = svc.Create(CreateSuggestionInput{IdeaID: "no-such-idea", UserID: "u1", Content: "x"})
	assert.ErrorIs(t, err, ErrSuggestionIdeaGone)
}

func TestSuggestionService_VoteDedupAndCount(t *testing.T) {
	svc, ideaID, _ := newSuggestionFixture(t)

	sug, err := svc.Create(CreateSuggestionInput{IdeaID: ideaID, UserID: "u1", Content: "s"})
	require.NoError(t, err)

	require.NoError(t, svc.Vote(ideaID, sug.ID, "u2", ""))
	require.NoError(t, svc.Vote(ideaID, sug.ID, "u3", ""))

	// 同一用户重复投票被拒
	assert.ErrorIs(t, svc.Vote(ideaID, sug.ID, "u2", ""), ErrSuggestionAlreadyVot)

	// 取消后可重投
	require.NoError(t, svc.Unvote(ideaID, sug.ID, "u2", ""))
	require.NoError(t, svc.Vote(ideaID, sug.ID, "u2", ""))

	views, err := svc.ListByIdea(ideaID, "u2", "")
	require.NoError(t, err)
	require.Len(t, views, 1)
	assert.Equal(t, 2, views[0].VoteCount)
	assert.True(t, views[0].Voted)

	// 未投票的 viewer 标记为 false
	views, err = svc.ListByIdea(ideaID, "u9", "")
	require.NoError(t, err)
	assert.False(t, views[0].Voted)
}

// 回归：Unvote 只能删除自己的投票，空身份 OR 条件不得误删他人投票。
func TestSuggestionService_UnvoteDoesNotDeleteOthersVotes(t *testing.T) {
	svc, ideaID, _ := newSuggestionFixture(t)

	sug, err := svc.Create(CreateSuggestionInput{IdeaID: ideaID, UserID: "u1", Content: "s"})
	require.NoError(t, err)
	require.NoError(t, svc.Vote(ideaID, sug.ID, "u2", ""))
	require.NoError(t, svc.Vote(ideaID, sug.ID, "u3", ""))

	// u2 取消投票：不得影响 u3 的票
	require.NoError(t, svc.Unvote(ideaID, sug.ID, "u2", ""))

	var votes int64
	svc.db.Model(&model.SuggestionVote{}).Where("suggestion_id = ?", sug.ID).Count(&votes)
	assert.Equal(t, int64(1), votes)

	var reloaded model.IdeaSuggestion
	require.NoError(t, svc.db.First(&reloaded, "id = ?", sug.ID).Error)
	assert.Equal(t, 1, reloaded.VoteCount)
}

// 回归：同一 owner（用户本人与其 Agent）合并为一个投票主体。
func TestSuggestionService_VoteOwnerScopeDedup(t *testing.T) {
	svc, ideaID, ownerID := newSuggestionFixture(t)
	suffix := uniqueSuffix()
	// 属于 owner 的另一个 agent
	agent2 := "agent2-" + suffix
	require.NoError(t, svc.db.Create(&model.Agent{ID: agent2, OwnerUserID: ownerID, Name: "a2", APIKeyHash: "h-" + suffix, Capabilities: "[]"}).Error)

	sug, err := svc.Create(CreateSuggestionInput{IdeaID: ideaID, UserID: "u1", Content: "s"})
	require.NoError(t, err)

	// owner 本人投票后，其 agent 再投应被拒
	require.NoError(t, svc.Vote(ideaID, sug.ID, ownerID, ""))
	assert.ErrorIs(t, svc.Vote(ideaID, sug.ID, "", agent2), ErrSuggestionAlreadyVot)

	var reloaded model.IdeaSuggestion
	require.NoError(t, svc.db.First(&reloaded, "id = ?", sug.ID).Error)
	assert.Equal(t, 1, reloaded.VoteCount)

	// 列表视角：owner 查看显示已投
	views, err := svc.ListByIdea(ideaID, ownerID, "")
	require.NoError(t, err)
	assert.True(t, views[0].Voted)
}

func TestSuggestionService_SelectOwnerOnlyAndCreatesJob(t *testing.T) {
	svc, ideaID, ownerID := newSuggestionFixture(t)
	db := svc.db

	sug, err := svc.Create(CreateSuggestionInput{IdeaID: ideaID, UserID: "u1", Content: "s"})
	require.NoError(t, err)

	// 非 owner 采纳被拒
	_, err = svc.Select(ideaID, sug.ID, "stranger", "")
	assert.ErrorIs(t, err, ErrSuggestionNotOwner)

	// owner 采纳：置 selected、建 pending job、concept → in_progress
	result, err := svc.Select(ideaID, sug.ID, ownerID, "")
	require.NoError(t, err)
	assert.NotEmpty(t, result.JobID)
	assert.True(t, result.Suggestion.Selected())

	var job model.ImplementationJob
	require.NoError(t, db.First(&job, "id = ?", result.JobID).Error)
	assert.Equal(t, "pending", job.Status)
	assert.Equal(t, ownerID, job.OwnerUserID)
	require.NotNil(t, job.SuggestionID)
	assert.Equal(t, sug.ID, *job.SuggestionID)
	assert.Contains(t, job.Brief, "suggestion_content")

	var idea model.Idea
	require.NoError(t, db.First(&idea, "id = ?", ideaID).Error)
	assert.Equal(t, model.ImplStatusInProgress, idea.ImplStatus)

	// 重复采纳幂等：不新建 job
	again, err := svc.Select(ideaID, sug.ID, ownerID, "")
	require.NoError(t, err)
	assert.Empty(t, again.JobID)
	var jobCount int64
	db.Model(&model.ImplementationJob{}).Where("idea_id = ?", ideaID).Count(&jobCount)
	assert.Equal(t, int64(1), jobCount)

	// 列表中已采纳排在最前
	svc.Create(CreateSuggestionInput{IdeaID: ideaID, UserID: "u2", Content: "another"})
	views, err := svc.ListByIdea(ideaID, "", "")
	require.NoError(t, err)
	require.Len(t, views, 2)
	assert.True(t, views[0].Selected)
	assert.False(t, views[1].Selected)

	// 已采纳的建议不能删除（避免 ImplementationJob 悬空）
	assert.ErrorIs(t, svc.Delete(ideaID, sug.ID, "u1", ""), ErrSuggestionSelected)
}

func TestSuggestionService_DeleteAuthorOnly(t *testing.T) {
	svc, ideaID, _ := newSuggestionFixture(t)

	sug, err := svc.Create(CreateSuggestionInput{IdeaID: ideaID, UserID: "u1", Content: "s"})
	require.NoError(t, err)

	// 非作者删除被拒
	assert.ErrorIs(t, svc.Delete(ideaID, sug.ID, "u2", ""), ErrSuggestionNotAuthor)

	// 作者本人删除成功（连带清理投票）
	require.NoError(t, svc.Vote(ideaID, sug.ID, "u3", ""))
	require.NoError(t, svc.Delete(ideaID, sug.ID, "u1", ""))
	var count int64
	svc.db.Model(&model.IdeaSuggestion{}).Where("id = ?", sug.ID).Count(&count)
	assert.Equal(t, int64(0), count)
	var votes int64
	svc.db.Model(&model.SuggestionVote{}).Where("suggestion_id = ?", sug.ID).Count(&votes)
	assert.Equal(t, int64(0), votes)
}

// 任务队列：owner 推进状态、终态锁定、完成不重复通知、建议计数维护。
func TestSuggestionService_JobLifecycleAndCounts(t *testing.T) {
	svc, ideaID, ownerID := newSuggestionFixture(t)

	// 建议计数随创建/删除维护
	sug, err := svc.Create(CreateSuggestionInput{IdeaID: ideaID, UserID: "u1", Content: "s1"})
	require.NoError(t, err)
	sug2, err := svc.Create(CreateSuggestionInput{IdeaID: ideaID, UserID: "u2", Content: "s2"})
	require.NoError(t, err)
	var idea model.Idea
	require.NoError(t, svc.db.First(&idea, "id = ?", ideaID).Error)
	assert.Equal(t, 2, idea.SuggestionCount)
	require.NoError(t, svc.Delete(ideaID, sug2.ID, "u2", ""))
	require.NoError(t, svc.db.First(&idea, "id = ?", ideaID).Error)
	assert.Equal(t, 1, idea.SuggestionCount)

	// 采纳创建任务
	result, err := svc.Select(ideaID, sug.ID, ownerID, "")
	require.NoError(t, err)
	require.NotEmpty(t, result.JobID)

	// 非 owner 推进被拒
	_, err = svc.UpdateJob(result.JobID, "stranger", "done", "")
	assert.ErrorIs(t, err, ErrSuggestionJobNotOwner)

	// owner: pending -> in_progress -> done
	job, err := svc.UpdateJob(result.JobID, ownerID, "in_progress", "")
	require.NoError(t, err)
	assert.Equal(t, "in_progress", job.Status)
	job, err = svc.UpdateJob(result.JobID, ownerID, "done", "v2 已发布")
	require.NoError(t, err)
	assert.Equal(t, "done", job.Status)
	assert.Equal(t, "v2 已发布", job.Note)

	// 终态不可再变
	_, err = svc.UpdateJob(result.JobID, ownerID, "failed", "")
	assert.Error(t, err)

	// 列表视图带 job_status
	views, err := svc.ListByIdea(ideaID, "", "")
	require.NoError(t, err)
	require.Len(t, views, 1)
	assert.Equal(t, "done", views[0].JobStatus)

	// 任务队列（owner 视角）
	jobs, err := svc.ListJobs(ownerID)
	require.NoError(t, err)
	require.Len(t, jobs, 1)
	assert.Equal(t, ideaID, jobs[0].IdeaID)
	assert.NotEmpty(t, jobs[0].IdeaTitle)
	assert.Equal(t, "s1", jobs[0].SuggestionContent)
}

// ---- 本地编码 Agent 桥（job bridge）----

func newJobFixture(t *testing.T) (*SuggestionService, *model.ImplementationJob, string) {
	t.Helper()
	svc, ideaID, ownerID := newSuggestionFixture(t)
	require.NoError(t, svc.db.AutoMigrate(&model.JobQuestion{}))
	job := &model.ImplementationJob{
		IdeaID: ideaID, OwnerUserID: ownerID, Status: "pending",
		Brief: `{"suggestion_content":"支持暗色模式"}`,
	}
	require.NoError(t, svc.db.Create(job).Error)
	return svc, job, ownerID
}

func TestJobBridge_ClaimNextJob(t *testing.T) {
	svc, job, ownerID := newJobFixture(t)

	// 非本人无任务可领
	spec, err := svc.ClaimNextJob("someone-else")
	require.NoError(t, err)
	assert.Nil(t, spec)

	// 领取成功：状态推进 + 规格内容完整
	spec, err = svc.ClaimNextJob(ownerID)
	require.NoError(t, err)
	require.NotNil(t, spec)
	assert.Equal(t, job.ID, spec.JobID)
	assert.Equal(t, "in_progress", spec.Status)
	assert.Equal(t, "支持暗色模式", spec.SuggestionContent)
	assert.NotEmpty(t, spec.IdeaTitle)

	// 领完即空
	spec, err = svc.ClaimNextJob(ownerID)
	require.NoError(t, err)
	assert.Nil(t, spec)
}

func TestJobBridge_ProgressAndTerminalGuards(t *testing.T) {
	svc, job, ownerID := newJobFixture(t)

	require.NoError(t, svc.AppendProgress(job.ID, ownerID, "脚手架完成"))
	require.NoError(t, svc.AppendProgress(job.ID, ownerID, "测试通过"))

	// 他人不可追加
	assert.ErrorIs(t, svc.AppendProgress(job.ID, "intruder", "x"), ErrSuggestionJobNotOwner)

	// GetJobSpec 含进展时间线
	spec, err := svc.GetJobSpec(job.ID, ownerID)
	require.NoError(t, err)
	require.Len(t, spec.Progress, 2)
	assert.Equal(t, "测试通过", spec.Progress[1].Note)

	// 终态后拒绝追加
	_, err = svc.UpdateJob(job.ID, ownerID, "done", "")
	require.NoError(t, err)
	assert.Error(t, svc.AppendProgress(job.ID, ownerID, "再多一条"))

	// 他人不可读规格
	_, err = svc.GetJobSpec(job.ID, "intruder")
	assert.ErrorIs(t, err, ErrSuggestionJobNotOwner)
}

func TestJobBridge_AskUserAnswer(t *testing.T) {
	svc, job, ownerID := newJobFixture(t)

	qid, err := svc.AskUser(job.ID, ownerID, "agent-x", "要不要暗色主题？")
	require.NoError(t, err)

	// 先回答再等待：应立即拿到答案
	require.NoError(t, svc.AnswerQuestion(qid, ownerID, "第一版不用"))
	answer, answered, err := svc.WaitForAnswer(context.Background(), qid, time.Second)
	require.NoError(t, err)
	assert.True(t, answered)
	assert.Equal(t, "第一版不用", answer)

	// 他人不能替 owner 回答
	qid2, err := svc.AskUser(job.ID, ownerID, "agent-x", "另一个问题？")
	require.NoError(t, err)
	assert.ErrorIs(t, svc.AnswerQuestion(qid2, "intruder", "抢答"), ErrSuggestionJobNotOwner)

	// ListJobs 暴露未答问题
	jobs, err := svc.ListJobs(ownerID)
	require.NoError(t, err)
	require.Len(t, jobs, 1)
	require.NotNil(t, jobs[0].PendingQuestion)
	assert.Equal(t, "另一个问题？", jobs[0].PendingQuestion.Question)

	// 终态任务拒绝提问
	_, err = svc.UpdateJob(job.ID, ownerID, "done", "")
	require.NoError(t, err)
	_, err = svc.AskUser(job.ID, ownerID, "agent-x", "还有问题")
	assert.Error(t, err)
}

func TestJobBridge_ReportResultSyncsIdea(t *testing.T) {
	svc, job, ownerID := newJobFixture(t)
	ideaID := job.IdeaID

	// Agent 路径：done 同步 idea + 回填仓库
	repo := "https://github.com/u/r"
	_, err := svc.ReportJobResult(job.ID, ownerID, "done", "完成", repo, "abc123")
	require.NoError(t, err)
	var idea model.Idea
	require.NoError(t, svc.db.Where("id = ?", ideaID).First(&idea).Error)
	assert.Equal(t, model.ImplStatusImplemented, idea.ImplStatus)
	assert.Equal(t, repo, idea.RepoURL)

	// 终态不可重复回报
	_, err = svc.ReportJobResult(job.ID, ownerID, "failed", "反悔", "", "")
	assert.Error(t, err)
}

func TestJobBridge_ManualDoneSyncsIdea(t *testing.T) {
	svc, job, ownerID := newJobFixture(t)

	// 手动路径：完成同样同步 idea 实现状态（与 Agent 路径一致）
	_, err := svc.UpdateJob(job.ID, ownerID, "done", "手工完成")
	require.NoError(t, err)
	var idea model.Idea
	require.NoError(t, svc.db.Where("id = ?", job.IdeaID).First(&idea).Error)
	assert.Equal(t, model.ImplStatusImplemented, idea.ImplStatus)
}
