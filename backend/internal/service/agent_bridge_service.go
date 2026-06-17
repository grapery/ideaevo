package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// AgentBridgeService 是 agent-bridge 入口的核心服务。
//
// 它面向"外部 AI agent"（如 Claude Code、Cursor、第三方自动化 agent），
// 让它们能通过 HTTP REST 以 agent 身份调用工具，无需走 MCP 协议。
//
// 与页面聊天的区别：
//   - 页面聊天：用户 JWT 认证 → LLM 决策 → 调工具
//   - agent-bridge：外部 agent 自己已经决策好 → 直接调工具
//
// 与 MCP 的区别：
//   - MCP 是独立进程（stdio/SSE），需要客户端支持 MCP 协议
//   - agent-bridge 是 REST 端点，任何 HTTP 客户端可用
type AgentBridgeService struct {
	db       *gorm.DB
	agentSvc *AgentService
	tools    *ToolExecutor
}

func NewAgentBridgeService(db *gorm.DB, agentSvc *AgentService, tools *ToolExecutor) *AgentBridgeService {
	return &AgentBridgeService{db: db, agentSvc: agentSvc, tools: tools}
}

// ListTools 返回该 agent 被允许使用的工具列表（OpenAI tools 格式）。
// 用于 agent-bridge 客户端发现可用工具，作为它自己的 LLM function calling 配置。
func (s *AgentBridgeService) ListTools(agent *model.Agent) ([]OpenAITool, error) {
	if s.tools == nil {
		return nil, fmt.Errorf("tool executor not configured")
	}
	return s.tools.ToolsDefinition(allowedToolsForAgent(agent)), nil
}

// ExecuteTool 让外部 agent 直接执行单个工具调用。
// agent 必须通过 API key 认证（由 handler 层完成）。
func (s *AgentBridgeService) ExecuteTool(ctx context.Context, agent *model.Agent, name string, args json.RawMessage) (*ToolResult, error) {
	if s.tools == nil {
		return nil, fmt.Errorf("tool executor not configured")
	}

	// 权限校验：agent 只能调用其 capabilities 声明的工具
	if !canAgentUseTool(agent, name) {
		return &ToolResult{
			OK:    false,
			Error: fmt.Sprintf("agent %q is not permitted to use tool %q", agent.Name, name),
		}, nil
	}

	var in ToolInput
	if len(args) > 0 {
		if err := json.Unmarshal(args, &in); err != nil {
			return &ToolResult{OK: false, Error: fmt.Sprintf("invalid args: %v", err)}, nil
		}
	}

	p := Principal{
		Source:   "agent_bridge",
		AgentID:  agent.ID,
		IdeaID:   "",
	}

	execCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	return s.tools.registry.Execute(execCtx, name, p, in)
}

// ExecuteBatch 让外部 agent 批量执行多个工具调用（典型场景：LLM 一次返回多个 tool_calls）。
func (s *AgentBridgeService) ExecuteBatch(ctx context.Context, agent *model.Agent, calls []ToolCall) ([]ToolCallResult, error) {
	if s.tools == nil {
		return nil, fmt.Errorf("tool executor not configured")
	}

	// 过滤掉无权限的工具
	allowed := make([]ToolCall, 0, len(calls))
	for _, c := range calls {
		if canAgentUseTool(agent, c.Name) {
			allowed = append(allowed, c)
		}
	}

	p := Principal{
		Source:  "agent_bridge",
		AgentID: agent.ID,
	}
	return s.tools.ExecuteBatch(ctx, p, allowed)
}

// ---- capability helpers ----

// allowedToolsForAgent 根据 agent.Capabilities 字段返回允许的工具白名单。
// 内置万叶助手（无 capabilities 限制）返回 nil 表示开放全部。
func allowedToolsForAgent(agent *model.Agent) []string {
	if agent == nil {
		return nil
	}
	if agent.Name == SystemAssistantName {
		return SystemCapabilities
	}
	return parseCapabilities(agent.Capabilities)
}

// canAgentUseTool 判断 agent 是否有权调用某工具。
// 无白名单时（capabilities 为空）默认开放全部工具（向后兼容）。
func canAgentUseTool(agent *model.Agent, toolName string) bool {
	if agent == nil {
		return false
	}
	allowed := allowedToolsForAgent(agent)
	if len(allowed) == 0 {
		return true // 未配置 capabilities = 开放全部
	}
	for _, a := range allowed {
		if a == toolName {
			return true
		}
	}
	return false
}

// parseCapabilities 解析 agent 的 capabilities JSONB 字段。
func parseCapabilities(raw string) []string {
	if raw == "" || raw == "[]" {
		return nil
	}
	var out []string
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return nil
	}
	return out
}
