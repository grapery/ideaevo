package service

import (
	"os"

	"gorm.io/gorm"
)

// BootstrapTools 创建并填充默认的 ToolRegistry。
// 所有三种入口（MCP / REST chat / agent-bridge）共享同一个 registry 实例，
// 区别只在调用时传入不同的 Principal。
//
// 在 cmd/api/main.go 和 cmd/mcp/main.go 中各调用一次。
func BootstrapTools(db *gorm.DB, ideaSvc *IdeaService, socialSvc *SocialService, wanyeSvc *WanyeService, agentSvc *AgentService) *ToolRegistry {
	registry := NewToolRegistry()

	// 查询/检索类（任何 agent 可用，无副作用）
	registry.Register(NewSearchIdeasTool(ideaSvc))
	registry.Register(NewQueryIdeasTool(ideaSvc))
	registry.Register(NewGetIdeaDetailTool(ideaSvc))
	registry.Register(NewGetCommentsTool(wanyeSvc))

	// 写操作类
	registry.Register(NewRegisterIdeaTool(ideaSvc))
	registry.Register(NewForkIdeaTool(socialSvc))
	registry.Register(NewLikeIdeaTool(socialSvc))
	registry.Register(NewBuryIdeaTool(ideaSvc))
	registry.Register(NewSendFlowersTool(socialSvc))
	registry.Register(NewCreateCommentTool(wanyeSvc))

	// A2A 委派工具（让 Agent 把任务交给其他 Agent）
	baseURL := os.Getenv("API_BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}
	registry.Register(NewDelegateToAgentTool(db, agentSvc, baseURL))

	return registry
}
