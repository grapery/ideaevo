package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/schema"
	"github.com/wanye/ideaevo/internal/config"
	einopkg "github.com/wanye/ideaevo/internal/eino"
	"github.com/wanye/ideaevo/internal/model"
)

// serviceToolAdapter 把 service.Tool 适配为 eino.ToolExecutor（打破循环导入）。
type serviceToolAdapter struct {
	impl Tool
}

func (a *serviceToolAdapter) Name() string       { return a.impl.Name() }
func (a *serviceToolAdapter) Description() string { return a.impl.Description() }
func (a *serviceToolAdapter) Parameters() json.RawMessage { return a.impl.Parameters() }
func (a *serviceToolAdapter) Execute(ctx context.Context, p einopkg.Principal, input map[string]any) (*einopkg.ToolResult, error) {
	sp := Principal{
		Source:            p.Source,
		UserID:            p.UserID,
		AgentID:           p.AgentID,
		SessionID:         p.SessionID,
		IdeaID:            p.IdeaID,
		IsSystemAssistant: p.IsSystemAssistant,
	}
	result, err := a.impl.Execute(ctx, sp, ToolInput(input))
	if err != nil {
		return nil, err
	}
	return &einopkg.ToolResult{
		OK:    result.OK,
		Data:  result.Data,
		Error: result.Error,
	}, nil
}

// convertToolsToEino 把 []service.Tool 转为 []einopkg.ToolExecutor。
func convertToolsToEino(tools []Tool) []einopkg.ToolExecutor {
	out := make([]einopkg.ToolExecutor, 0, len(tools))
	for _, t := range tools {
		out = append(out, &serviceToolAdapter{impl: t})
	}
	return out
}

// EinoChatResult 是 Eino Agent 的非流式调用结果。
type EinoChatResult struct {
	Content   string
	Usage     int // 估算 token 数（Eino 不直接返回 usage）
}

// RunEinoAgent 用 Eino ReAct Agent 执行一轮对话（非流式）。
//
// 调用方（ChatService.SendMessage）决定是否走此路径：
//   - Agent 有 LLMModel 或 SystemPrompt 设置 → 走 Eino
//   - 否则走传统 llm_service.go（向后兼容）
//
// 参数：
//   - agent: 目标 Agent（含 system prompt / model / temperature）
//   - llmCfg: 全局 LLM 配置（API Key / BaseURL）
//   - toolRegistry: 工具注册表（提供可用工具）
//   - principal: 调用方身份（注入 context 供工具使用）
//   - systemPrompt: RAG 增强后的 system prompt（如果 agent.SystemPrompt 为空则用此值）
//   - history: 对话历史
//   - userInput: 当前用户输入
func (s *ChatService) RunEinoAgent(
	ctx context.Context,
	agent *model.Agent,
	llmCfg config.LLMConfig,
	toolRegistry *ToolRegistry,
	principal Principal,
	fallbackSystemPrompt string,
	history []einopkg.HistoryMessage,
	userInput string,
) (*EinoChatResult, error) {

	// 1. 创建 ChatModel
	cm, err := einopkg.NewChatModelForAgent(ctx, agent, llmCfg)
	if err != nil {
		return nil, fmt.Errorf("eino chat model: %w", err)
	}

	// 2. 收集工具并适配为 Eino 格式
	var einoTools []tool.BaseTool
	if toolRegistry != nil {
		// 根据 agent capabilities 过滤工具
		allowedNames := filterToolNamesByAgent(agent, toolRegistry)
		rawTools := toolRegistry.GetByNames(allowedNames)
		einoTools = einopkg.WrapToolsForEino(convertToolsToEino(rawTools))
	}

	// 3. 确定 system prompt
	sysPrompt := agent.SystemPrompt
	if sysPrompt == "" {
		sysPrompt = fallbackSystemPrompt
	}

	// 4. 构建 ReAct Agent
	runner, err := einopkg.BuildAgent(ctx, einopkg.AgentBuildConfig{
		ChatModel:    cm,
		Tools:        einoTools,
		SystemPrompt: sysPrompt,
	})
	if err != nil {
		return nil, fmt.Errorf("eino agent build: %w", err)
	}

	// 5. 构建消息列表（历史 + 当前输入）
	msgs := einopkg.ToEinoMessages(history)
	msgs = append(msgs, &schema.Message{
		Role:    schema.User,
		Content: userInput,
	})

	// 6. 注入 Principal 到 context
	ctx = einopkg.WithPrincipal(ctx, einopkg.Principal{
		Source:            principal.Source,
		UserID:            principal.UserID,
		AgentID:           principal.AgentID,
		SessionID:         principal.SessionID,
		IdeaID:            principal.IdeaID,
		IsSystemAssistant: principal.IsSystemAssistant,
	})

	// 7. 执行
	resp, err := runner.Generate(ctx, msgs)
	if err != nil {
		return nil, fmt.Errorf("eino agent generate: %w", err)
	}

	// 8. 估算 token（简单估算：字符数 / 3）
	estTokens := len(userInput) / 3
	if resp != nil {
		estTokens += len(resp.Content) / 3
	}

	return &EinoChatResult{
		Content:   resp.Content,
		Usage:     estTokens,
	}, nil
}

// RunEinoAgentStream 用 Eino ReAct Agent 执行流式对话。
// 返回一个 StreamReader，调用方负责消费。
func (s *ChatService) RunEinoAgentStream(
	ctx context.Context,
	agent *model.Agent,
	llmCfg config.LLMConfig,
	toolRegistry *ToolRegistry,
	principal Principal,
	fallbackSystemPrompt string,
	history []einopkg.HistoryMessage,
	userInput string,
) (*schema.StreamReader[*schema.Message], string, error) {

	// 1. 创建 ChatModel
	cm, err := einopkg.NewChatModelForAgent(ctx, agent, llmCfg)
	if err != nil {
		return nil, "", fmt.Errorf("eino chat model: %w", err)
	}

	// 2. 工具适配
	var einoTools []tool.BaseTool
	if toolRegistry != nil {
		allowedNames := filterToolNamesByAgent(agent, toolRegistry)
		rawTools := toolRegistry.GetByNames(allowedNames)
		einoTools = einopkg.WrapToolsForEino(convertToolsToEino(rawTools))
	}

	// 3. System prompt
	sysPrompt := agent.SystemPrompt
	if sysPrompt == "" {
		sysPrompt = fallbackSystemPrompt
	}

	// 4. 构建 Agent
	runner, err := einopkg.BuildAgent(ctx, einopkg.AgentBuildConfig{
		ChatModel:    cm,
		Tools:        einoTools,
		SystemPrompt: sysPrompt,
	})
	if err != nil {
		return nil, "", fmt.Errorf("eino agent build: %w", err)
	}

	// 5. 消息列表
	msgs := einopkg.ToEinoMessages(history)
	msgs = append(msgs, &schema.Message{
		Role:    schema.User,
		Content: userInput,
	})

	// 6. 注入 Principal
	ctx = einopkg.WithPrincipal(ctx, einopkg.Principal{
		Source:            principal.Source,
		UserID:            principal.UserID,
		AgentID:           principal.AgentID,
		SessionID:         principal.SessionID,
		IdeaID:            principal.IdeaID,
		IsSystemAssistant: principal.IsSystemAssistant,
	})

	// 7. 流式执行
	reader, err := runner.Stream(ctx, msgs)
	if err != nil {
		return nil, "", fmt.Errorf("eino agent stream: %w", err)
	}

	return reader, sysPrompt, nil
}

// filterToolNamesByAgent 根据 agent 的 capabilities 返回允许的工具名列表。
// 空 capabilities = 全部工具（向后兼容）。
func filterToolNamesByAgent(agent *model.Agent, registry *ToolRegistry) []string {
	allNames := registry.Names()
	if agent == nil || agent.Capabilities == "" || agent.Capabilities == "[]" {
		return allNames
	}

	// 解析 capabilities JSON
	var caps []string
	if err := json.Unmarshal([]byte(agent.Capabilities), &caps); err != nil {
		return allNames
	}
	if len(caps) == 0 {
		return allNames
	}

	// 匹配：如果 capabilities 包含通用能力标签（如 "code"），开放全部工具
	// 如果包含具体工具名（如 "search_ideas"），只开放那些
	var matched []string
	for _, name := range allNames {
		for _, cap := range caps {
			if strings.EqualFold(name, cap) {
				matched = append(matched, name)
				break
			}
		}
	}
	if len(matched) == 0 {
		// capabilities 是通用标签（非工具名），开放全部
		log.Printf("[eino] agent %s capabilities %v are generic tags, opening all tools", agent.ID, caps)
		return allNames
	}
	return matched
}

// ShouldUseEino 判断一个 Agent 是否应该走 Eino 路径。
// 有自定义 SystemPrompt 或 LLMModel 的用户 Agent 走 Eino；
// 万叶助手（系统 Agent）走传统路径（向后兼容）。
func ShouldUseEino(agent *model.Agent) bool {
	if agent == nil {
		return false
	}
	// 系统 Agent（万叶助手）保持传统路径
	if agent.OwnerUserID == "" && agent.APIKeyHash == "system-assistant-no-api-key" {
		return false
	}
	// 有自定义配置的用户 Agent 走 Eino
	return agent.SystemPrompt != "" || agent.LLMModel != ""
}
