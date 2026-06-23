// Package eino 提供基于 cloudwego/eino 框架的 Agent 能力。
//
// 这一层负责：
//   - 将 ideaevo 的全局 LLM 配置（DashScope/Ark/OpenAI 兼容）适配为 Eino ChatModel
//   - 将现有 ToolRegistry 的 10 个工具适配为 Eino InvokableTool
//   - 用 Eino ReAct Agent 替换手写的工具循环
package eino

import (
	"context"
	"fmt"
	"time"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
	openaimodel "github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/wanye/ideaevo/internal/config"
	imodel "github.com/wanye/ideaevo/internal/model"
)

// ChatModelConfig 合并 Agent 级配置与全局 LLM 配置，生成 Eino ChatModel 的初始化参数。
type ChatModelConfig struct {
	APIKey      string
	BaseURL     string
	Model       string // Agent 自定义模型名；空则用全局默认
	Temperature float64
	MaxTokens   int
	Timeout     time.Duration
}

// NewChatModelForAgent 根据全局 LLM 配置 + Agent 级配置创建 Eino ChatModel。
//
// Agent 可以自定义模型名（agent.LLMModel）和温度（agent.Temperature），
// API Key / BaseURL 始终来自全局配置（安全考虑，不实现 per-agent key）。
func NewChatModelForAgent(ctx context.Context, agent *imodel.Agent, llmCfg config.LLMConfig) (model.ToolCallingChatModel, error) {
	if !llmCfg.Enabled() {
		return nil, fmt.Errorf("LLM not configured (no API key)")
	}

	// Agent 自定义模型名优先，否则用全局
	modelName := llmCfg.Model
	if agent != nil && agent.LLMModel != "" {
		modelName = agent.LLMModel
	}

	cfg := &openaimodel.ChatModelConfig{
		APIKey:  llmCfg.APIKey,
		BaseURL: llmCfg.BaseURL,
		Model:   modelName,
		Timeout: 120 * time.Second,
	}

	// Agent 级温度（0 = 用默认）
	if agent != nil && agent.Temperature > 0 {
		t := float32(agent.Temperature)
		cfg.Temperature = &t
	}

	// Agent 级 max tokens
	if agent != nil && agent.MaxTokens > 0 {
		mt := agent.MaxTokens
		cfg.MaxTokens = &mt
	}

	cm, err := openaimodel.NewChatModel(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create eino chat model: %w", err)
	}

	return cm, nil
}

// ToEinoMessages 将 ideaevo 的历史消息转换为 Eino schema.Message 列表。
type HistoryMessage struct {
	Role    string // "user" | "assistant" | "system"
	Content string
}

func ToEinoMessages(history []HistoryMessage) []*schema.Message {
	msgs := make([]*schema.Message, 0, len(history))
	for _, h := range history {
		var role schema.RoleType
		switch h.Role {
		case "user":
			role = schema.User
		case "assistant":
			role = schema.Assistant
		case "system":
			role = schema.System
		default:
			role = schema.User
		}
		msgs = append(msgs, &schema.Message{
			Role:    role,
			Content: h.Content,
		})
	}
	return msgs
}
