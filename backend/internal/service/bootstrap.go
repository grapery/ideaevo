package service

import (
	"context"

	"gorm.io/gorm"
)

// BootstrapTools 创建并填充默认的 ToolRegistry。
// delegateFn 是进程内 A2A 委派函数（由 main.go 注入，避免循环依赖）。
func BootstrapTools(db *gorm.DB, ideaSvc *IdeaService, socialSvc *SocialService, commentSvc *CommentService, agentSvc *AgentService, followSvc *FollowService, assets *ObjectStore, delegateFn DelegateFunc, suggestionSvc *SuggestionService) *ToolRegistry {
	registry := NewToolRegistry()

	// 查询/检索类（任何 agent 可用，无副作用）
	registry.Register(NewSearchIdeasTool(ideaSvc))
	registry.Register(NewQueryIdeasTool(ideaSvc))
	registry.Register(NewGetIdeaDetailTool(ideaSvc))
	registry.Register(NewGetCommentsTool(commentSvc))
	registry.Register(NewGetAgentTool(agentSvc))
	registry.Register(NewListAgentFollowingTool(agentSvc))
	registry.Register(NewListAgentFollowersTool(followSvc, agentSvc))
	registry.Register(NewGetAgentActivityTool(agentSvc))
	registry.Register(NewListIdeaSuggestionsTool(suggestionSvc))
	registry.Register(NewGetIdeaStatsTool(ideaSvc))
	registry.Register(NewGetIdeaVersionsTool(ideaSvc))
	registry.Register(NewGetRankingTool(ideaSvc))
	registry.Register(NewListAgentIdeasTool(ideaSvc))
	registry.Register(NewGetFlowerSendersTool(socialSvc))
	registry.Register(NewGetIdeaLineageTool(socialSvc))
	registry.Register(NewGetActivityFeedTool(db))

	// 写操作类
	registry.Register(NewRegisterIdeaTool(ideaSvc))
	registry.Register(NewUpdateIdeaMetaTool(ideaSvc, assets))
	registry.Register(NewForkIdeaTool(socialSvc))
	registry.Register(NewLikeIdeaTool(socialSvc))
	registry.Register(NewWishIdeaTool(socialSvc))
	registry.Register(NewUnwishIdeaTool(socialSvc))
	registry.Register(NewBuryIdeaTool(ideaSvc))
	registry.Register(NewArchiveIdeaTool(ideaSvc))
	registry.Register(NewImplementIdeaTool(ideaSvc))
	registry.Register(NewReactivateIdeaTool(ideaSvc))
	registry.Register(NewSendFlowersTool(socialSvc))
	registry.Register(NewCreateCommentTool(commentSvc))
	registry.Register(NewCreateIdeaSuggestionTool(suggestionSvc))
	registry.Register(NewVoteSuggestionTool(suggestionSvc))
	registry.Register(NewSelectSuggestionTool(suggestionSvc))
	registry.Register(NewDeleteSuggestionTool(suggestionSvc))
	registry.Register(NewFollowUserTool(followSvc, agentSvc))
	registry.Register(NewUnfollowUserTool(followSvc, agentSvc))
	registry.Register(NewBookmarkIdeaTool(ideaSvc, agentSvc))
	registry.Register(NewUnbookmarkIdeaTool(ideaSvc, agentSvc))
	registry.Register(NewReactIdeaTool(socialSvc))
	registry.Register(NewUnreactIdeaTool(socialSvc))
	registry.Register(NewUpdateCommentTool(commentSvc))
	registry.Register(NewDeleteCommentTool(commentSvc))
	registry.Register(NewUpdateIdeaDescriptionTool(ideaSvc, assets))
	registry.Register(NewPublishIdeaVersionTool(ideaSvc))
	progressSvc := NewProgressService(db)
	registry.Register(NewListProgressTool(progressSvc))
	registry.Register(NewReportProgressTool(ideaSvc, progressSvc))

	// 私域自查（双视图：用户在自己的 AI 工具里了解在做什么、做的如何）
	registry.Register(NewGetMyOverviewTool(NewOverviewService(db)))
	registry.Register(NewGetMySignalsTool(NewAgentSignalService(db)))
	registry.Register(NewFollowAgentTool(followSvc))
	registry.Register(NewUnfollowAgentTool(followSvc))
	registry.Register(NewPostAgentActivityTool(agentSvc))

	// 本地编码 Agent 桥：Claude Code / Codex / Zcode 经 MCP 操作任务队列
	registry.Register(NewGetJobSpecTool(suggestionSvc, agentSvc))
	registry.Register(NewListMyJobsTool(suggestionSvc, agentSvc))
	registry.Register(NewGetIdeaChangelogTool(ideaSvc))
	registry.Register(NewClaimNextJobTool(suggestionSvc, agentSvc))
	registry.Register(NewSendProgressTool(suggestionSvc, agentSvc))
	registry.Register(NewAskUserTool(suggestionSvc, agentSvc))
	registry.Register(NewReportJobResultTool(suggestionSvc, agentSvc))

	// A2A 委派工具（让 Agent 把任务交给其他 Agent）
	if delegateFn != nil {
		registry.Register(NewDelegateToAgentTool(db, agentSvc, delegateFn))
	}

	// 确保编译器知道 context 被使用（delegateFn 内部用到）
	_ = context.Background()

	return registry
}
