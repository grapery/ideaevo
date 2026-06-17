package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	mcpgolang "github.com/mark3labs/mcp-go/server"
	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service"
	"gorm.io/gorm"
)

type Server struct {
	mcpServer *mcpgolang.MCPServer
	agentSvc  *service.AgentService
	socialSvc *service.SocialService
	chatSvc   *service.ChatService
	userSvc   *service.UserService
	db        *gorm.DB

	// tools 注入后，所有 MCP 工具调用会委托给 ToolRegistry 执行
	// （同一份实现服务于 MCP / REST / agent-bridge 三个入口）。
	tools *service.ToolExecutor
}

func NewServer(agentSvc *service.AgentService, socialSvc *service.SocialService, chatSvc *service.ChatService, userSvc *service.UserService, db *gorm.DB) *Server {
	s := &Server{
		agentSvc:  agentSvc,
		socialSvc: socialSvc,
		chatSvc:   chatSvc,
		userSvc:   userSvc,
		db:        db,
	}

	mcpServer := mcpgolang.NewMCPServer(
		"wanye-marketplace",
		"1.0.0",
		mcpgolang.WithToolCapabilities(true),
	)

	s.mcpServer = mcpServer
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

// registerBridgedTools 在 ToolRegistry 注入后，为其中每个工具创建 MCP 包装器，
// 使 MCP 客户端透明地调用同一份工具实现（与 REST chat / agent-bridge 行为一致，
// 含二次确认、capabilities 过滤）。
func (s *Server) registerBridgedTools() {
	if s.tools == nil {
		return
	}
	for _, t := range s.tools.ToolsDefinition(nil) {
		name := t.Function.Name
		desc := t.Function.Description
		schema := t.Function.Parameters

		// 复制闭包变量避免循环变量问题
		toolName := name
		toolSchema := schema

		mcpTool := mcp.NewToolWithRawSchema(toolName, desc, toolSchema)
		s.mcpServer.AddTool(mcpTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// MCP 工具仍要求 api_key 参数做认证（向后兼容现有客户端）
			apiKey := req.GetString("api_key", "")
			var principal service.Principal
			if apiKey != "" {
				agent, err := s.agentSvc.ValidateAPIKey(apiKey)
				if err != nil {
					return nil, fmt.Errorf("invalid api_key: %w", err)
				}
				principal = service.Principal{
					Source:   "mcp",
					AgentID:  agent.ID,
					IsSystemAssistant: false,
				}
			} else {
				// 只读工具（search/query/get_*）允许匿名访问
				principal = service.Principal{Source: "mcp"}
			}

			// 转换 MCP 入参 → ToolExecutor 期望的 ToolCall
			args, _ := json.Marshal(req.Params.Arguments)
			call := service.ToolCall{
				ID:       fmt.Sprintf("mcp-%d", time.Now().UnixNano()),
				Name:     toolName,
				ArgsJSON: args,
			}

			results, err := s.tools.ExecuteBatch(ctx, principal, []service.ToolCall{call})
			if err != nil {
				return nil, err
			}
			if len(results) == 0 {
				return mcp.NewToolResultText("{}"), nil
			}
			return mcp.NewToolResultText(results[0].Output), nil
		})
	}
}

// GetServer 返回底层 mcp-go server，供 stdio/SSE 传输层使用。
func (s *Server) GetServer() *mcpgolang.MCPServer {
	return s.mcpServer
}

// authenticate validates the api_key parameter and returns the agent ID.
func (s *Server) authenticate(req mcp.CallToolRequest) (string, error) {
	apiKey := req.GetString("api_key", "")
	if apiKey == "" {
		return "", fmt.Errorf("api_key is required")
	}
	agent, err := s.agentSvc.ValidateAPIKey(apiKey)
	if err != nil {
		return "", fmt.Errorf("invalid api_key: %w", err)
	}
	return agent.ID, nil
}

// registerTools 注册 MCP 专属工具（ToolRegistry 未覆盖的能力）。
//
// 想法市场核心工具（register/search/query/fork/like/bury/flowers/comment 等）
// 统一由 registerBridgedTools 从共享 ToolRegistry 桥接，保证三入口行为一致。
// 这里只保留 ToolRegistry 不提供、围绕 user/chat 的工具，避免与桥接工具重名。
func (s *Server) registerTools() {
	// unlike（ToolRegistry 未提供取消点赞，保留独立实现）
	s.mcpServer.AddTool(mcp.NewTool("unlike",
		mcp.WithDescription("Remove your like from an idea."),
		mcp.WithString("api_key", mcp.Required(), mcp.Description("Your Wanye API key")),
		mcp.WithString("idea_id", mcp.Required(), mcp.Description("ID of the idea to unlike")),
	), s.handleUnlike)

	// get_me
	s.mcpServer.AddTool(mcp.NewTool("get_me",
		mcp.WithDescription("Get information about the authenticated agent."),
		mcp.WithString("api_key", mcp.Required(), mcp.Description("Your Wanye API key")),
	), s.handleGetMe)

	// create_chat_session
	s.mcpServer.AddTool(mcp.NewTool("create_chat_session",
		mcp.WithDescription("Create a new chat session with an agent."),
		mcp.WithString("api_key", mcp.Required(), mcp.Description("Your Wanye API key")),
		mcp.WithString("agent_id", mcp.Required(), mcp.Description("ID of the agent to chat with")),
		mcp.WithString("idea_id", mcp.Description("Optional idea ID to bind the session to")),
		mcp.WithString("title", mcp.Description("Optional session title")),
	), s.handleCreateChatSession)

	// send_chat_message
	s.mcpServer.AddTool(mcp.NewTool("send_chat_message",
		mcp.WithDescription("Send a message in a chat session and get the assistant's reply."),
		mcp.WithString("api_key", mcp.Required(), mcp.Description("Your Wanye API key")),
		mcp.WithString("session_id", mcp.Required(), mcp.Description("ID of the chat session")),
		mcp.WithString("content", mcp.Required(), mcp.Description("Message content")),
	), s.handleSendChatMessage)

	// get_chat_history
	s.mcpServer.AddTool(mcp.NewTool("get_chat_history",
		mcp.WithDescription("Get chat message history for a session."),
		mcp.WithString("api_key", mcp.Required(), mcp.Description("Your Wanye API key")),
		mcp.WithString("session_id", mcp.Required(), mcp.Description("ID of the chat session")),
		mcp.WithNumber("limit", mcp.Description("Max messages to return (default 50)")),
		mcp.WithString("before_id", mcp.Description("Get messages before this message ID")),
	), s.handleGetChatHistory)

	// list_chat_sessions
	s.mcpServer.AddTool(mcp.NewTool("list_chat_sessions",
		mcp.WithDescription("List chat sessions for the authenticated agent."),
		mcp.WithString("api_key", mcp.Required(), mcp.Description("Your Wanye API key")),
		mcp.WithNumber("limit", mcp.Description("Max sessions to return (default 20)")),
		mcp.WithNumber("offset", mcp.Description("Pagination offset")),
	), s.handleListChatSessions)

	// get_user_profile
	s.mcpServer.AddTool(mcp.NewTool("get_user_profile",
		mcp.WithDescription("Get a user's public profile including stats."),
		mcp.WithString("user_id", mcp.Required(), mcp.Description("ID of the user")),
	), s.handleGetUserProfile)

	// get_user_activity
	s.mcpServer.AddTool(mcp.NewTool("get_user_activity",
		mcp.WithDescription("Get recent activity records for a user."),
		mcp.WithString("user_id", mcp.Required(), mcp.Description("ID of the user")),
		mcp.WithNumber("limit", mcp.Description("Max records to return (default 20)")),
		mcp.WithNumber("offset", mcp.Description("Pagination offset")),
	), s.handleGetUserActivity)
}

func getArgs(req mcp.CallToolRequest) map[string]interface{} {
	if args, ok := req.Params.Arguments.(map[string]interface{}); ok {
		return args
	}
	return map[string]interface{}{}
}

func getFloatArg(args map[string]interface{}, key string) float64 {
	if v, ok := args[key].(float64); ok {
		return v
	}
	return 0
}

func (s *Server) handleUnlike(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	agentID, err := s.authenticate(req)
	if err != nil {
		return nil, err
	}
	s.socialSvc.UnlikeIdea(req.GetString("idea_id", ""), "", agentID)
	return mcp.NewToolResultText("Unliked successfully"), nil
}

func (s *Server) handleGetMe(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	agentID, err := s.authenticate(req)
	if err != nil {
		return nil, err
	}
	agent, err := s.agentSvc.GetByID(agentID)
	if err != nil {
		return nil, err
	}
	data, _ := json.Marshal(agent)
	return mcp.NewToolResultText(string(data)), nil
}

func (s *Server) handleCreateChatSession(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	agentID, err := s.authenticate(req)
	if err != nil {
		return nil, err
	}
	userID := "agent:" + agentID

	session, err := s.chatSvc.CreateSession(userID, service.CreateSessionInput{
		AgentID: req.GetString("agent_id", ""),
		IdeaID:  req.GetString("idea_id", ""),
		Title:   req.GetString("title", ""),
	})
	if err != nil {
		return nil, err
	}
	data, _ := json.Marshal(session)
	return mcp.NewToolResultText(string(data)), nil
}

func (s *Server) handleSendChatMessage(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	agentID, err := s.authenticate(req)
	if err != nil {
		return nil, err
	}
	userID := "agent:" + agentID

	result, err := s.chatSvc.SendMessage(req.GetString("session_id", ""), userID, service.SendMessageInput{
		Content: req.GetString("content", ""),
	})
	if err != nil {
		return nil, err
	}
	data, _ := json.Marshal(result)
	return mcp.NewToolResultText(string(data)), nil
}

func (s *Server) handleGetChatHistory(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	agentID, err := s.authenticate(req)
	if err != nil {
		return nil, err
	}
	userID := "agent:" + agentID

	args := getArgs(req)
	limit := int(getFloatArg(args, "limit"))
	if limit == 0 {
		limit = 50
	}

	messages, err := s.chatSvc.GetMessages(req.GetString("session_id", ""), userID, req.GetString("before_id", ""), limit)
	if err != nil {
		return nil, err
	}
	data, _ := json.Marshal(map[string]interface{}{"messages": messages})
	return mcp.NewToolResultText(string(data)), nil
}

func (s *Server) handleListChatSessions(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	agentID, err := s.authenticate(req)
	if err != nil {
		return nil, err
	}
	userID := "agent:" + agentID

	args := getArgs(req)
	limit := int(getFloatArg(args, "limit"))
	offset := int(getFloatArg(args, "offset"))
	if limit == 0 {
		limit = 20
	}

	sessions, total, err := s.chatSvc.ListSessions(userID, limit, offset)
	if err != nil {
		return nil, err
	}
	data, _ := json.Marshal(map[string]interface{}{"sessions": sessions, "total": total})
	return mcp.NewToolResultText(string(data)), nil
}

func (s *Server) handleGetUserProfile(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	profile, err := s.userSvc.GetProfile(req.GetString("user_id", ""))
	if err != nil {
		return nil, err
	}
	data, _ := json.Marshal(profile)
	return mcp.NewToolResultText(string(data)), nil
}

func (s *Server) handleGetUserActivity(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	userID := req.GetString("user_id", "")
	args := getArgs(req)
	limit := int(getFloatArg(args, "limit"))
	offset := int(getFloatArg(args, "offset"))
	if limit == 0 {
		limit = 20
	}

	var activities []model.ActivityLog
	s.db.Where("actor_id = ? AND actor_type = ?", userID, "user").
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&activities)

	data, _ := json.Marshal(map[string]interface{}{"activities": activities})
	return mcp.NewToolResultText(string(data)), nil
}
