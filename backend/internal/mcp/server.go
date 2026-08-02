package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service"
	"gorm.io/gorm"
)

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
}

func NewServer(agentSvc *service.AgentService, socialSvc *service.SocialService, chatSvc *service.ChatService, userSvc *service.UserService, db *gorm.DB) *Server {
	s := &Server{
		agentSvc:  agentSvc,
		socialSvc: socialSvc,
		chatSvc:   chatSvc,
		userSvc:   userSvc,
		db:        db,
	}

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
			// MCP 工具仍要求 api_key 参数做认证（向后兼容现有客户端）
			var rawArgs map[string]any
			if len(req.Params.Arguments) > 0 {
				_ = json.Unmarshal(req.Params.Arguments, &rawArgs)
			}
			apiKey, _ := rawArgs["api_key"].(string)

			var principal service.Principal
			if apiKey != "" {
				agent, err := s.agentSvc.ValidateAPIKey(apiKey)
				if err != nil {
					return nil, fmt.Errorf("invalid api_key: %w", err)
				}
				// 付费门控：通过 api_key 调用 MCP 工具要求 Agent owner 为付费会员。
				if s.subSvc != nil {
					if err := s.subSvc.EnsureCanUseMCP(agent.OwnerUserID); err != nil {
						return nil, fmt.Errorf("MCP requires a paid subscription (agent owner is not Pro)")
					}
				}
				principal = service.Principal{
					Source:           "mcp",
					AgentID:          agent.ID,
					IsSystemAssistant: false,
				}
			} else {
				// 只读工具（search/query/get_*）允许匿名访问（免费用户可浏览）
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

// authenticate validates the api_key parameter and returns the agent ID.
// 注入 subSvc 后，额外校验 Agent owner 是否为付费会员（免费用户不能用 MCP 工具）。
func (s *Server) authenticate(apiKey string) (string, error) {
	if apiKey == "" {
		return "", fmt.Errorf("api_key is required")
	}
	agent, err := s.agentSvc.ValidateAPIKey(apiKey)
	if err != nil {
		return "", fmt.Errorf("invalid api_key: %w", err)
	}
	if s.subSvc != nil {
		if err := s.subSvc.EnsureCanUseMCP(agent.OwnerUserID); err != nil {
			return "", fmt.Errorf("MCP requires a paid subscription (agent owner is not Pro)")
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

type unlikeInput struct {
	APIKey string `json:"api_key" jsonschema:"your Deimos API key"`
	IdeaID string `json:"idea_id" jsonschema:"ID of the idea to unlike"`
}

type getMeInput struct {
	APIKey string `json:"api_key" jsonschema:"your Deimos API key"`
}

type createChatSessionInput struct {
	APIKey  string `json:"api_key"            jsonschema:"your Deimos API key"`
	AgentID string `json:"agent_id"           jsonschema:"ID of the agent to chat with"`
	IdeaID  string `json:"idea_id,omitempty"  jsonschema:"optional idea ID to bind the session to"`
	Title   string `json:"title,omitempty"    jsonschema:"optional session title"`
}

type sendChatMessageInput struct {
	APIKey    string `json:"api_key"   jsonschema:"your Deimos API key"`
	SessionID string `json:"session_id" jsonschema:"ID of the chat session"`
	Content   string `json:"content"   jsonschema:"message content"`
}

type getChatHistoryInput struct {
	APIKey    string `json:"api_key"              jsonschema:"your Deimos API key"`
	SessionID string `json:"session_id"          jsonschema:"ID of the chat session"`
	Limit     int    `json:"limit,omitempty"      jsonschema:"max messages to return (default 50)"`
	BeforeID  string `json:"before_id,omitempty"  jsonschema:"get messages before this message ID"`
}

type listChatSessionsInput struct {
	APIKey string `json:"api_key"          jsonschema:"your Deimos API key"`
	Limit  int    `json:"limit,omitempty"  jsonschema:"max sessions to return (default 20)"`
	Offset int    `json:"offset,omitempty" jsonschema:"pagination offset"`
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
	agentID, err := s.authenticate(in.APIKey)
	if err != nil {
		return nil, nil, err
	}
	s.socialSvc.UnlikeIdea(in.IdeaID, "", agentID)
	return textResult("Unliked successfully"), nil, nil
}

func (s *Server) handleGetMe(ctx context.Context, req *mcp.CallToolRequest, in getMeInput) (*mcp.CallToolResult, any, error) {
	agentID, err := s.authenticate(in.APIKey)
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
	agentID, err := s.authenticate(in.APIKey)
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
	agentID, err := s.authenticate(in.APIKey)
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
	agentID, err := s.authenticate(in.APIKey)
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
	agentID, err := s.authenticate(in.APIKey)
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
	profile, err := s.userSvc.GetProfile(in.UserID)
	if err != nil {
		return nil, nil, err
	}
	res, err := marshalResult(profile)
	return res, nil, err
}

func (s *Server) handleGetUserActivity(ctx context.Context, req *mcp.CallToolRequest, in getUserActivityInput) (*mcp.CallToolResult, any, error) {
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
