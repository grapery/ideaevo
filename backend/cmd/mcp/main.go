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
	wanyeSvc := service.NewWanyeService(db)
	emailSvc := service.NewEmailService(cfg)
	assets, _ := service.NewObjectStore(cfg)
	userSvc := service.NewUserService(db, emailSvc, cfg.FrontendURL, assets)
	llmSvc := service.NewLLMService(cfg.LLMAPIKey, cfg.LLMBaseURL, cfg.LLMModel)
	chatSvc := service.NewChatService(db, ideaSvc, agentSvc, llmSvc)

	// 共享 ToolRegistry：MCP 工具与 REST chat / agent-bridge 使用同一份实现
	toolRegistry := service.BootstrapTools(db, ideaSvc, socialSvc, wanyeSvc)
	toolExecutor := service.NewToolExecutor(toolRegistry)

	mcpServer := mcphandler.NewServer(agentSvc, socialSvc, chatSvc, userSvc, db).
		WithToolExecutor(toolExecutor)

	switch cfg.MCPTransport {
	case "sse":
		port := os.Getenv("MCP_PORT")
		if port == "" {
			port = "9090"
		}
		sseServer := mcpgolang.NewSSEServer(mcpServer.GetServer())
		fmt.Printf("Starting Wanye MCP Server (SSE) on :%s\n", port)
		if err := sseServer.Start(":" + port); err != nil {
			fmt.Fprintf(os.Stderr, "SSE server error: %v\n", err)
			os.Exit(1)
		}
	default:
		fmt.Println("Starting Wanye MCP Server (stdio)")
		if err := mcpgolang.NewStdioServer(mcpServer.GetServer()).Listen(context.Background(), os.Stdin, os.Stdout); err != nil {
			fmt.Fprintf(os.Stderr, "stdio server error: %v\n", err)
			os.Exit(1)
		}
	}
}
