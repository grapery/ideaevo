package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service"
	"gorm.io/gorm"
)

// readOnlyTools 是只读工具白名单：仅查询、不修改任何数据。
// 这些工具对所有人免费（含非 Pro 的带 key 调用），符合「免费用户可浏览市场」的产品意图。
// 写操作（register/fork/comment/like/flowers 等）仍要求 Pro 会员。
var readOnlyTools = map[string]bool{
	"search_ideas":          true,
	"query_ideas":           true,
	"get_idea_detail":       true,
	"get_comments":          true,
	"list_idea_suggestions": true,
	"get_idea_stats":        true,
	"get_idea_versions":     true,
	"get_ranking":           true,
	"list_agent_ideas":      true,
	"get_flower_senders":    true,
	"get_agent":             true,
	"list_agent_following":  true,
	"list_agent_followers":  true,
	"get_agent_activity":    true,
	"get_me":                true,
	"get_chat_history":      true,
	"list_chat_sessions":    true,
	"get_user_profile":      true,
	"get_user_activity":     true,
	"get_job_spec":          true,
	"list_my_jobs":          true,
	"get_idea_changelog":    true,
	"get_idea_lineage":      true,
	"get_activity_feed":     true,
	// 私域自查类(只读, 不写任何数据; 仍需 api_key 因为绑定身份)
	"list_progress":         true,
	"get_my_overview":       true,
	"get_my_signals":        true,
}

// ctxKeyHTTPAgent 标记由 HTTP 层（requireAPIKey）验证过的 agent，避免工具层重复要求 api_key 参数。
type ctxKeyHTTPAgent struct{}

// HTTPAgentContextKey 返回用于在 context 中存取 HTTP 层验证过的 agent 的 key。
// 供 cmd/mcp 的鉴权中间件注入身份。
func HTTPAgentContextKey() any { return ctxKeyHTTPAgent{} }

// rateLimitKey 从调用上下文提取限速 key（agent ID）。
// 优先 HTTP 层注入的 agent；其次 stdio 的 DEIMOS_API_KEY 环境身份；
// 再次用调用方显式提供的 api_key 字符串（校验前先限速，无效 key 也无法绕过）；
// 都没有则匿名共享桶。
func (s *Server) rateLimitKey(ctx context.Context, rawArgs map[string]any) string {
	if httpAgent, ok := ctx.Value(ctxKeyHTTPAgent{}).(*model.Agent); ok && httpAgent != nil {
		return httpAgent.ID
	}
	if s.envAgent != nil {
		return s.envAgent.ID
	}
	if rawArgs != nil {
		if apiKey, _ := rawArgs["api_key"].(string); apiKey != "" {
			return "key:" + apiKey
		}
	}
	return mcpAnonKey
}

// ptrStr 安全解引用 *string，nil 返回空串。
func ptrStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

type Server struct {
	mcpServer *mcp.Server
	agentSvc  *service.AgentService
	socialSvc *service.SocialService
	chatSvc   *service.ChatService
	userSvc   *service.UserService
	db        *gorm.DB

	// tools 注入后，所有 MCP 工具调用会委托给 ToolRegistry 执行
	// （同一份实现服务于 MCP / REST / agent-bridge 三个入口）。
	tools *service.ToolExecutor

	// subSvc 注入后，通过 api_key 调用 MCP 写/专属工具要求付费会员。
	subSvc *service.SubscriptionService

	// envAgent 是 DEIMOS_API_KEY 环境变量解析出的默认身份（stdio 本地使用），
	// 优先级低于 HTTP 层 context 与工具参数 api_key。
	envAgent *model.Agent

	// limiter 按 agent 限速 MCP 调用（1 req/s），防止 AI Agent 高频重试打爆后端。
	limiter *RateLimiter
}

func NewServer(agentSvc *service.AgentService, socialSvc *service.SocialService, chatSvc *service.ChatService, userSvc *service.UserService, db *gorm.DB) *Server {
	s := &Server{
		agentSvc:  agentSvc,
		socialSvc: socialSvc,
		chatSvc:   chatSvc,
		userSvc:   userSvc,
		db:        db,
	}

	s.limiter = NewRateLimiter(nil)

	s.mcpServer = mcp.NewServer(
		&mcp.Implementation{Name: "deimos-marketplace", Version: "1.0.0"},
		&mcp.ServerOptions{
			Capabilities: &mcp.ServerCapabilities{Tools: &mcp.ToolCapabilities{ListChanged: true}},
		},
	)

	s.registerTools()
	return s
}

// WithToolExecutor 注入共享的工具执行器。
// 注入后，所有写操作（register/fork/bury/flowers）都会经过二次确认机制；
// 所有工具的实际逻辑由 ToolRegistry 中的实现统一处理，MCP handler 只做参数适配。
func (s *Server) WithToolExecutor(tools *service.ToolExecutor) *Server {
	s.tools = tools
	s.registerBridgedTools()
	return s
}

// WithSubscription 注入会员服务以启用 MCP 付费门控。
// 注入后，通过 api_key 调用 MCP 写/专属工具要求该 Agent 的 owner 为付费会员。
func (s *Server) WithSubscription(subSvc *service.SubscriptionService) *Server {
	s.subSvc = subSvc
	return s
}

// WithEnvAPIKey 解析 DEIMOS_API_KEY 环境变量作为 stdio 模式的默认身份，
// 让本地配置（如 Claude Code 的 mcpServers env）无需每个工具调用都传 api_key。
func (s *Server) WithEnvAPIKey(key string) *Server {
	if key == "" {
		return s
	}
	agent, err := s.agentSvc.ValidateAPIKey(key)
	if err != nil {
		fmt.Fprintf(os.Stderr, "deimos-mcp: invalid DEIMOS_API_KEY, ignoring (%v)\n", err)
		return s
	}
	s.envAgent = agent
	return s
}

// registerBridgedTools 在 ToolRegistry 注入后，为其中每个工具创建 MCP 包装器，
// 使 MCP 客户端透明地调用同一份工具实现（与 REST chat / agent-bridge 行为一致，
// 含二次确认、capabilities 过滤）。
func (s *Server) registerBridgedTools() {
	if s.tools == nil {
		return
	}
	for _, t := range s.tools.ToolsDefinition(nil) {
		// 复制闭包变量避免循环变量问题
		toolName := t.Function.Name
		toolDesc := t.Function.Description
		toolSchema := t.Function.Parameters // json.RawMessage，直接作为 raw schema

		// 用低层 AddTool + raw InputSchema（schema 来自共享 ToolRegistry，
		// 无法静态转 typed struct），handler 自行解析 req.Params.Arguments。
		s.mcpServer.AddTool(&mcp.Tool{
			Name:        toolName,
			Description: toolDesc,
			InputSchema: toolSchema,
		}, func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// 鉴权：身份来源优先级 HTTP 层 context > 工具参数 api_key > 匿名。
			// HTTP 层（requireAPIKey）验证过的 agent 注入在 ctx，远程 MCP 客户端
			//（Cursor/Codex 经 Authorization 头鉴权）无需每个工具再传 api_key 参数。
			var rawArgs map[string]any
			if len(req.Params.Arguments) > 0 {
				_ = json.Unmarshal(req.Params.Arguments, &rawArgs)
			}
			isReadOnly := readOnlyTools[toolName]

			// 限速优先于一切：读、写、鉴权失败都先过桶，避免被拒的调用方继续高频打点。
			if !s.limiter.Allow(s.rateLimitKey(ctx, rawArgs)) {
				return nil, ErrRateLimited
			}

			var principal service.Principal
			if httpAgent, ok := ctx.Value(ctxKeyHTTPAgent{}).(*model.Agent); ok && httpAgent != nil {
				// HTTP 层已鉴权：只读工具直接放行；写操作仍校验 Pro。
				if !isReadOnly && s.subSvc != nil {
					if err := s.subSvc.EnsureCanUseMCP(httpAgent.OwnerUserID); err != nil {
						return nil, fmt.Errorf("MCP write tools require a paid subscription (agent owner is not Pro)")
					}
				}
				principal = service.Principal{Source: "mcp", AgentID: httpAgent.ID}
			} else if apiKey, _ := rawArgs["api_key"].(string); apiKey != "" {
				// stdio 老用法：工具参数传 api_key。向后兼容。
				agent, err := s.agentSvc.ValidateAPIKey(apiKey)
				if err != nil {
					return nil, fmt.Errorf("invalid api_key: %w", err)
				}
				if !isReadOnly && s.subSvc != nil {
					if err := s.subSvc.EnsureCanUseMCP(agent.OwnerUserID); err != nil {
						return nil, fmt.Errorf("MCP write tools require a paid subscription (agent owner is not Pro)")
					}
				}
				principal = service.Principal{Source: "mcp", AgentID: agent.ID}
			} else if s.envAgent != nil {
				// DEIMOS_API_KEY 环境变量（stdio 本地配置）：作为默认身份。
				if !isReadOnly && s.subSvc != nil {
					if err := s.subSvc.EnsureCanUseMCP(s.envAgent.OwnerUserID); err != nil {
						return nil, fmt.Errorf("MCP write tools require a paid subscription (agent owner is not Pro)")
					}
				}
				principal = service.Principal{Source: "mcp", AgentID: s.envAgent.ID}
			} else {
				// 匿名：只读工具放行（免费浏览市场），写操作拒绝。
				if !isReadOnly {
					return nil, fmt.Errorf("api_key required for write operations")
				}
				principal = service.Principal{Source: "mcp"}
			}

			// req.Params.Arguments 已是 json.RawMessage，可直接作为 ArgsJSON 传入
			call := service.ToolCall{
				ID:       fmt.Sprintf("mcp-%d", time.Now().UnixNano()),
				Name:     toolName,
				ArgsJSON: req.Params.Arguments,
			}

			results, err := s.tools.ExecuteBatch(ctx, principal, []service.ToolCall{call})
			if err != nil {
				return nil, err
			}
			if len(results) == 0 {
				return textResult("{}"), nil
			}
			return textResult(results[0].Output), nil
		})
	}
}

// GetServer 返回底层 mcp server，供 stdio/SSE 传输层使用。
func (s *Server) GetServer() *mcp.Server {
	return s.mcpServer
}

// authenticate 解析调用者身份，返回 agent ID。
// 身份来源优先级：HTTP 层 context（远程 MCP）> api_key 参数（stdio 老用法）。
// isReadOnly=true 时跳过 Pro 门控（只读工具对所有人免费）。
func (s *Server) authenticate(ctx context.Context, apiKey string, isReadOnly bool) (string, error) {
	// 限速优先于鉴权与 Pro 门控。
	if !s.limiter.Allow(s.rateLimitKey(ctx, map[string]any{"api_key": apiKey})) {
		return "", ErrRateLimited
	}
	// HTTP 层已鉴权：直接取注入的 agent。
	if httpAgent, ok := ctx.Value(ctxKeyHTTPAgent{}).(*model.Agent); ok && httpAgent != nil {
		if !isReadOnly && s.subSvc != nil {
			if err := s.subSvc.EnsureCanUseMCP(httpAgent.OwnerUserID); err != nil {
				return "", fmt.Errorf("MCP write tools require a paid subscription (agent owner is not Pro)")
			}
		}
		return httpAgent.ID, nil
	}
	// stdio 老用法：工具参数 api_key。
	if apiKey == "" {
		return "", fmt.Errorf("api_key is required")
	}
	agent, err := s.agentSvc.ValidateAPIKey(apiKey)
	if err != nil {
		return "", fmt.Errorf("invalid api_key: %w", err)
	}
	if !isReadOnly && s.subSvc != nil {
		if err := s.subSvc.EnsureCanUseMCP(agent.OwnerUserID); err != nil {
			return "", fmt.Errorf("MCP write tools require a paid subscription (agent owner is not Pro)")
		}
	}
	return agent.ID, nil
}

// registerTools 注册 MCP 专属工具（ToolRegistry 未覆盖的能力）。
//
// 想法市场核心工具（register/search/query/fork/like/bury/flowers/comment 等）
// 统一由 registerBridgedTools 从共享 ToolRegistry 桥接，保证三入口行为一致。
// 这里只保留 ToolRegistry 不提供、围绕 user/chat 的工具，避免与桥接工具重名。
//
// 每个工具用 typed struct 声明入参（带 json/jsonschema tag），由 mcp.AddTool
// 自动生成 schema 与校验；handler 直接拿到类型化输入，无需手动解析参数。
func (s *Server) registerTools() {
	// unlike（ToolRegistry 未提供取消点赞，保留独立实现）
	mcp.AddTool(s.mcpServer, &mcp.Tool{
		Name:        "unlike",
		Description: "Remove your like from an idea.",
	}, s.handleUnlike)

	// get_me
	mcp.AddTool(s.mcpServer, &mcp.Tool{
		Name:        "get_me",
		Description: "Get information about the authenticated agent.",
	}, s.handleGetMe)

	// create_chat_session
	mcp.AddTool(s.mcpServer, &mcp.Tool{
		Name:        "create_chat_session",
		Description: "Create a new chat session with an agent.",
	}, s.handleCreateChatSession)

	// send_chat_message
	mcp.AddTool(s.mcpServer, &mcp.Tool{
		Name:        "send_chat_message",
		Description: "Send a message in a chat session and get the assistant's reply.",
	}, s.handleSendChatMessage)

	// get_chat_history
	mcp.AddTool(s.mcpServer, &mcp.Tool{
		Name:        "get_chat_history",
		Description: "Get chat message history for a session.",
	}, s.handleGetChatHistory)

	// list_chat_sessions
	mcp.AddTool(s.mcpServer, &mcp.Tool{
		Name:        "list_chat_sessions",
		Description: "List chat sessions for the authenticated agent.",
	}, s.handleListChatSessions)

	// get_user_profile
	mcp.AddTool(s.mcpServer, &mcp.Tool{
		Name:        "get_user_profile",
		Description: "Get a user's public profile including stats.",
	}, s.handleGetUserProfile)

	// get_user_activity
	mcp.AddTool(s.mcpServer, &mcp.Tool{
		Name:        "get_user_activity",
		Description: "Get recent activity records for a user.",
	}, s.handleGetUserActivity)

	// delete_chat_session
	mcp.AddTool(s.mcpServer, &mcp.Tool{
		Name:        "delete_chat_session",
		Description: "Delete one of your chat sessions (irreversible).",
	}, s.handleDeleteChatSession)
}

// textResult 构造一个只含文本内容的 CallToolResult。
func textResult(s string) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		Content: []mcp.Content{&mcp.TextContent{Text: s}},
	}
}

// marshalResult 把任意值序列化为 JSON 文本结果。
func marshalResult(v any) (*mcp.CallToolResult, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	return textResult(string(data)), nil
}

// ---- 工具入参 struct ----
// api_key 统一用指针 + omitempty：远程 MCP 客户端经 HTTP Authorization 头鉴权后，
// 身份注入 context，无需每个工具再传 api_key（schema 里标为 optional）。
// stdio 客户端仍可通过 api_key 参数传身份（向后兼容）。

type unlikeInput struct {
	APIKey *string `json:"api_key,omitempty" jsonschema:"your Deimos API key (optional when authenticated via HTTP)"`
	IdeaID string  `json:"idea_id"           jsonschema:"ID of the idea to unlike"`
}

type getMeInput struct {
	APIKey *string `json:"api_key,omitempty" jsonschema:"your Deimos API key (optional when authenticated via HTTP)"`
}

type createChatSessionInput struct {
	APIKey  *string `json:"api_key,omitempty"   jsonschema:"your Deimos API key (optional when authenticated via HTTP)"`
	AgentID string  `json:"agent_id"            jsonschema:"ID of the agent to chat with"`
	IdeaID  string  `json:"idea_id,omitempty"   jsonschema:"optional idea ID to bind the session to"`
	Title   string  `json:"title,omitempty"     jsonschema:"optional session title"`
}

type sendChatMessageInput struct {
	APIKey    *string `json:"api_key,omitempty"   jsonschema:"your Deimos API key (optional when authenticated via HTTP)"`
	SessionID string  `json:"session_id"          jsonschema:"ID of the chat session"`
	Content   string  `json:"content"             jsonschema:"message content"`
}

type getChatHistoryInput struct {
	APIKey    *string `json:"api_key,omitempty"    jsonschema:"your Deimos API key (optional when authenticated via HTTP)"`
	SessionID string  `json:"session_id"           jsonschema:"ID of the chat session"`
	Limit     int     `json:"limit,omitempty"      jsonschema:"max messages to return (default 50)"`
	BeforeID  string  `json:"before_id,omitempty"  jsonschema:"get messages before this message ID"`
}

type listChatSessionsInput struct {
	APIKey *string `json:"api_key,omitempty"  jsonschema:"your Deimos API key (optional when authenticated via HTTP)"`
	Limit  int     `json:"limit,omitempty"    jsonschema:"max sessions to return (default 20)"`
	Offset int     `json:"offset,omitempty"   jsonschema:"pagination offset"`
}

type deleteChatSessionInput struct {
	APIKey    *string `json:"api_key,omitempty"  jsonschema:"your Deimos API key (optional when authenticated via HTTP)"`
	SessionID string  `json:"session_id"         jsonschema:"ID of the chat session to delete"`
}

func (s *Server) handleDeleteChatSession(ctx context.Context, req *mcp.CallToolRequest, in deleteChatSessionInput) (*mcp.CallToolResult, any, error) {
	agentID, err := s.authenticate(ctx, ptrStr(in.APIKey), false)
	if err != nil {
		return nil, nil, err
	}
	if err := s.chatSvc.DeleteSession(in.SessionID, "agent:"+agentID); err != nil {
		return nil, nil, err
	}
	return textResult("Chat session deleted"), nil, nil
}

type getUserProfileInput struct {
	UserID string `json:"user_id" jsonschema:"ID of the user"`
}

type getUserActivityInput struct {
	UserID string `json:"user_id"          jsonschema:"ID of the user"`
	Limit  int    `json:"limit,omitempty"  jsonschema:"max records to return (default 20)"`
	Offset int    `json:"offset,omitempty" jsonschema:"pagination offset"`
}

// ---- 工具 handler ----

func (s *Server) handleUnlike(ctx context.Context, req *mcp.CallToolRequest, in unlikeInput) (*mcp.CallToolResult, any, error) {
	agentID, err := s.authenticate(ctx, ptrStr(in.APIKey), false)
	if err != nil {
		return nil, nil, err
	}
	s.socialSvc.UnlikeIdea(in.IdeaID, "", agentID)
	return textResult("Unliked successfully"), nil, nil
}

func (s *Server) handleGetMe(ctx context.Context, req *mcp.CallToolRequest, in getMeInput) (*mcp.CallToolResult, any, error) {
	agentID, err := s.authenticate(ctx, ptrStr(in.APIKey), true)
	if err != nil {
		return nil, nil, err
	}
	agent, err := s.agentSvc.GetByID(agentID)
	if err != nil {
		return nil, nil, err
	}
	res, err := marshalResult(agent)
	return res, nil, err
}

func (s *Server) handleCreateChatSession(ctx context.Context, req *mcp.CallToolRequest, in createChatSessionInput) (*mcp.CallToolResult, any, error) {
	agentID, err := s.authenticate(ctx, ptrStr(in.APIKey), false)
	if err != nil {
		return nil, nil, err
	}
	userID := "agent:" + agentID

	session, err := s.chatSvc.CreateSession(userID, service.CreateSessionInput{
		AgentID: in.AgentID,
		IdeaID:  in.IdeaID,
		Title:   in.Title,
	})
	if err != nil {
		return nil, nil, err
	}
	res, err := marshalResult(session)
	return res, nil, err
}

func (s *Server) handleSendChatMessage(ctx context.Context, req *mcp.CallToolRequest, in sendChatMessageInput) (*mcp.CallToolResult, any, error) {
	agentID, err := s.authenticate(ctx, ptrStr(in.APIKey), false)
	if err != nil {
		return nil, nil, err
	}
	userID := "agent:" + agentID

	result, err := s.chatSvc.SendMessage(in.SessionID, userID, service.SendMessageInput{
		Content: in.Content,
	})
	if err != nil {
		return nil, nil, err
	}
	res, err := marshalResult(result)
	return res, nil, err
}

func (s *Server) handleGetChatHistory(ctx context.Context, req *mcp.CallToolRequest, in getChatHistoryInput) (*mcp.CallToolResult, any, error) {
	agentID, err := s.authenticate(ctx, ptrStr(in.APIKey), true)
	if err != nil {
		return nil, nil, err
	}
	userID := "agent:" + agentID

	limit := in.Limit
	if limit == 0 {
		limit = 50
	}

	messages, err := s.chatSvc.GetMessages(in.SessionID, userID, in.BeforeID, limit)
	if err != nil {
		return nil, nil, err
	}
	res, err := marshalResult(map[string]any{"messages": messages})
	return res, nil, err
}

func (s *Server) handleListChatSessions(ctx context.Context, req *mcp.CallToolRequest, in listChatSessionsInput) (*mcp.CallToolResult, any, error) {
	agentID, err := s.authenticate(ctx, ptrStr(in.APIKey), true)
	if err != nil {
		return nil, nil, err
	}
	userID := "agent:" + agentID

	limit := in.Limit
	if limit == 0 {
		limit = 20
	}

	sessions, total, err := s.chatSvc.ListSessions(userID, limit, in.Offset)
	if err != nil {
		return nil, nil, err
	}
	res, err := marshalResult(map[string]any{"sessions": sessions, "total": total})
	return res, nil, err
}

func (s *Server) handleGetUserProfile(ctx context.Context, req *mcp.CallToolRequest, in getUserProfileInput) (*mcp.CallToolResult, any, error) {
	if !s.limiter.Allow(s.rateLimitKey(ctx, nil)) {
		return nil, nil, ErrRateLimited
	}
	profile, err := s.userSvc.GetProfile(in.UserID)
	if err != nil {
		return nil, nil, err
	}
	res, err := marshalResult(profile)
	return res, nil, err
}

func (s *Server) handleGetUserActivity(ctx context.Context, req *mcp.CallToolRequest, in getUserActivityInput) (*mcp.CallToolResult, any, error) {
	if !s.limiter.Allow(s.rateLimitKey(ctx, nil)) {
		return nil, nil, ErrRateLimited
	}
	limit := in.Limit
	if limit == 0 {
		limit = 20
	}

	var activities []model.ActivityLog
	s.db.Where("actor_id = ? AND actor_type = ?", in.UserID, "user").
		Order("created_at DESC").
		Limit(limit).Offset(in.Offset).
		Find(&activities)

	res, err := marshalResult(map[string]any{"activities": activities})
	return res, nil, err
}
