package service

import (
	"context"

	"gorm.io/gorm"
)

// BootstrapTools 创建并填充默认的 ToolRegistry。
// delegateFn 是进程内 A2A 委派函数（由 main.go 注入，避免循环依赖）。
func BootstrapTools(db *gorm.DB, ideaSvc *IdeaService, socialSvc *SocialService, wanyeSvc *WanyeService, agentSvc *AgentService, assets *ObjectStore, delegateFn DelegateFunc) *ToolRegistry {
	registry := NewToolRegistry()

	// 查询/检索类（任何 agent 可用，无副作用）
	registry.Register(NewSearchIdeasTool(ideaSvc))
	registry.Register(NewQueryIdeasTool(ideaSvc))
	registry.Register(NewGetIdeaDetailTool(ideaSvc))
	registry.Register(NewGetCommentsTool(wanyeSvc))

	// 写操作类
	registry.Register(NewRegisterIdeaTool(ideaSvc))
	registry.Register(NewUpdateIdeaMetaTool(ideaSvc, assets))
	registry.Register(NewForkIdeaTool(socialSvc))
	registry.Register(NewLikeIdeaTool(socialSvc))
	registry.Register(NewBuryIdeaTool(ideaSvc))
	registry.Register(NewSendFlowersTool(socialSvc))
	registry.Register(NewCreateCommentTool(wanyeSvc))

	// A2A 委派工具（让 Agent 把任务交给其他 Agent）
	if delegateFn != nil {
		registry.Register(NewDelegateToAgentTool(db, agentSvc, delegateFn))
	}

	// 确保编译器知道 context 被使用（delegateFn 内部用到）
	_ = context.Background()

	return registry
}
