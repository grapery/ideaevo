package eino

import (
	"context"
	"fmt"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/flow/agent/react"
	einoschema "github.com/cloudwego/eino/schema"
)

// AgentRunner 封装 Eino ReAct Agent，提供与现有 ChatService 兼容的调用接口。
type AgentRunner struct {
	agent *react.Agent
}

// AgentBuildConfig 构建参数。
type AgentBuildConfig struct {
	ChatModel    model.ToolCallingChatModel
	Tools        []tool.BaseTool
	SystemPrompt string // 为空时用 Eino 默认
}

// BuildAgent 构建 Eino ReAct Agent。
// ReAct Agent 内部自动实现「LLM → 工具调用 → 结果回灌 → 再推理」的循环，
// 替换原来手写的 runConversationWithProgress 工具循环。
func BuildAgent(ctx context.Context, cfg AgentBuildConfig) (*AgentRunner, error) {
	if cfg.ChatModel == nil {
		return nil, fmt.Errorf("ChatModel is required")
	}

	reactCfg := &react.AgentConfig{
		ToolCallingModel: cfg.ChatModel,
	}

	if len(cfg.Tools) > 0 {
		// ToolsNodeConfig 内嵌 Tools []tool.BaseTool
		reactCfg.ToolsConfig.Tools = cfg.Tools
	}

	if cfg.SystemPrompt != "" {
		reactCfg.MessageModifier = func(ctx context.Context, msgs []*einoschema.Message) []*einoschema.Message {
			// 在消息列表前插入 system prompt
			return append([]*einoschema.Message{
				{Role: einoschema.System, Content: cfg.SystemPrompt},
			}, msgs...)
		}
	}

	agent, err := react.NewAgent(ctx, reactCfg)
	if err != nil {
		return nil, fmt.Errorf("create react agent: %w", err)
	}

	return &AgentRunner{agent: agent}, nil
}

// Generate 非流式调用。
// ctx 应通过 WithPrincipal 注入 Principal，供工具使用。
func (r *AgentRunner) Generate(ctx context.Context, messages []*einoschema.Message) (*einoschema.Message, error) {
	return r.agent.Generate(ctx, messages)
}

// Stream 流式调用。
// ctx 应通过 WithPrincipal 注入 Principal，供工具使用。
func (r *AgentRunner) Stream(ctx context.Context, messages []*einoschema.Message) (*einoschema.StreamReader[*einoschema.Message], error) {
	return r.agent.Stream(ctx, messages)
}
