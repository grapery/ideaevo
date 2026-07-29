package main

import (
	"context"
	"fmt"
	"os"

	mcpgolang "github.com/mark3labs/mcp-go/server"
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
	llmSvc := service.NewLLMService(cfg.LLM)
	chatSvc := service.NewChatService(db, ideaSvc, agentSvc, llmSvc)

	// 共享 ToolRegistry：MCP 工具与 REST chat / agent-bridge 使用同一份实现
	// MCP 不注册 delegate_to_agent（A2A 委派仅在 REST chat 中可用）
	toolRegistry := service.BootstrapTools(db, ideaSvc, socialSvc, commentSvc, agentSvc, assets, nil)
	toolExecutor := service.NewToolExecutor(toolRegistry)

	// 计费/会员模块：启用 MCP 付费门控 + token 额度计量
	quotaSvc := service.NewQuotaService(db)
	subSvc := service.NewSubscriptionService(db, quotaSvc, agentSvc)
	chatSvc.SetSubscription(subSvc)

	mcpServer := mcphandler.NewServer(agentSvc, socialSvc, chatSvc, userSvc, db).
		WithToolExecutor(toolExecutor).
		WithSubscription(subSvc)

	switch cfg.MCPTransport {
	case "sse":
		port := os.Getenv("MCP_PORT")
		if port == "" {
			port = "9090"
		}
		sseServer := mcpgolang.NewSSEServer(mcpServer.GetServer())
		fmt.Printf("Starting Deimos MCP Server (SSE) on :%s\n", port)
		if err := sseServer.Start(":" + port); err != nil {
			fmt.Fprintf(os.Stderr, "SSE server error: %v\n", err)
			os.Exit(1)
		}
	default:
		fmt.Println("Starting Deimos MCP Server (stdio)")
		if err := mcpgolang.NewStdioServer(mcpServer.GetServer()).Listen(context.Background(), os.Stdin, os.Stdout); err != nil {
			fmt.Fprintf(os.Stderr, "stdio server error: %v\n", err)
			os.Exit(1)
		}
	}
}
