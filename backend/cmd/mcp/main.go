package main

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/wanye/ideaevo/internal/config"
	"github.com/wanye/ideaevo/internal/database"
	mcphandler "github.com/wanye/ideaevo/internal/mcp"
	"github.com/wanye/ideaevo/internal/service"
)

func main() {
	cfg := config.Load()
	db := database.Connect(cfg)

	agentSvc := service.NewAgentService(db)
	ideaSvc := service.NewIdeaService(db)
	socialSvc := service.NewSocialService(db)
	commentSvc := service.NewCommentService(db)
	emailSvc := service.NewEmailService(cfg)
	assets, _ := service.NewObjectStore(cfg)
	userSvc := service.NewUserService(db, emailSvc, cfg.FrontendURL, assets)
	notifSvc := service.NewNotificationService(db)
	followSvc := service.NewFollowService(db, notifSvc)
	llmSvc := service.NewLLMService(cfg.LLM)
	chatSvc := service.NewChatService(db, ideaSvc, agentSvc, llmSvc)

	// 共享 ToolRegistry：MCP 工具与 REST chat / agent-bridge 使用同一份实现
	// MCP 不注册 delegate_to_agent（A2A 委派仅在 REST chat 中可用）
	toolRegistry := service.BootstrapTools(db, ideaSvc, socialSvc, commentSvc, agentSvc, followSvc, assets, nil)
	toolExecutor := service.NewToolExecutor(toolRegistry)

	// 计费/会员模块：启用 MCP 付费门控 + token 额度计量
	quotaSvc := service.NewQuotaService(db)
	subSvc := service.NewSubscriptionService(db, quotaSvc, agentSvc)
	chatSvc.SetSubscription(subSvc)

	mcpServer := mcphandler.NewServer(agentSvc, socialSvc, chatSvc, userSvc, db).
		WithToolExecutor(toolExecutor).
		WithSubscription(subSvc)

	srv := mcpServer.GetServer()

	switch cfg.MCPTransport {
	case "sse":
		// 用官方 SDK 推荐的 Streamable HTTP 传输取代已 deprecated 的 SSE。
		// 仍由 MCP_TRANSPORT=sse / MCP_PORT 选择，保持现有部署配置不变。
		port := os.Getenv("MCP_PORT")
		if port == "" {
			port = "9090"
		}
		handler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return srv }, nil)
		fmt.Printf("Starting Deimos MCP Server (Streamable HTTP) on :%s\n", port)
		if err := http.ListenAndServe(":"+port, handler); err != nil {
			fmt.Fprintf(os.Stderr, "HTTP server error: %v\n", err)
			os.Exit(1)
		}
	default:
		fmt.Println("Starting Deimos MCP Server (stdio)")
		if err := srv.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
			fmt.Fprintf(os.Stderr, "stdio server error: %v\n", err)
			os.Exit(1)
		}
	}
}
