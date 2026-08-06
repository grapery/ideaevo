package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

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
		mcpHandler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return srv }, nil)
		// HTTP 层鉴权：远程暴露必须校验准入凭证，否则公网任何人可调工具。
		// 与 per-tool-call 的 api_key 鉴权正交：这里只做「连接准入」。
		authed := requireAPIKey(agentSvc, mcpHandler)
		fmt.Printf("Starting Deimos MCP Server (Streamable HTTP) on :%s\n", port)
		if err := http.ListenAndServe(":"+port, authed); err != nil {
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

// requireAPIKey 是 HTTP 层鉴权中间件，校验请求的准入凭证，并把验证过的 agent 注入 context。
// 凭证来源（按优先级）：
//  1. MCP_AUTH_TOKEN 环境变量：若设置，则用它做固定 token 比对（便于 Cursor 配置单一 token）。
//  2. Agent API Key：读 Authorization: Bearer <key> 或 X-API-Key，走 ValidateAPIKey（SHA-256 校验）。
//
// 验证成功的 agent 会注入 request context，供工具层复用（远程 MCP 客户端无需每个工具再传 api_key）。
// 固定 token 模式不绑定 agent，工具层会回退到 api_key 参数鉴权。
func requireAPIKey(agentSvc *service.AgentService, next http.Handler) http.Handler {
	staticToken := os.Getenv("MCP_AUTH_TOKEN")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// OPTIONS 预检直接放行（Streamable HTTP 客户端可能发 CORS 预检）。
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}
		token := extractBearer(r)
		if token == "" {
			w.Header().Set("WWW-Authenticate", `Bearer realm="deimos-mcp"`)
			http.Error(w, "missing api key: provide Authorization: Bearer <key> or X-API-Key", http.StatusUnauthorized)
			return
		}
		// 固定 token 优先（部署方自设，不依赖某个 Agent）。
		if staticToken != "" && token == staticToken {
			next.ServeHTTP(w, r)
			return
		}
		// 走 Agent key 校验（复用现有 SHA-256 验证路径），成功则把 agent 注入 context。
		agent, err := agentSvc.ValidateAPIKey(token)
		if err != nil {
			http.Error(w, "invalid api key", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), mcphandler.HTTPAgentContextKey(), agent)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// extractBearer 从 Authorization: Bearer xxx 或 X-API-Key 头提取凭证。
func extractBearer(r *http.Request) string {
	if k := r.Header.Get("X-API-Key"); k != "" {
		return strings.TrimSpace(k)
	}
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return ""
	}
	// 兼容 "Bearer xxx" 与裸 token 两种写法。
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
	}
	return strings.TrimSpace(auth)
}
