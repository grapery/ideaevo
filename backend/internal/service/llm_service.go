package service

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type LLMMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`

	// 工具调用相关（用于多轮 tool use 对话）
	ToolCalls    []ToolCall `json:"tool_calls,omitempty"`    // role=assistant 且 LLM 请求工具时
	ToolCallID   string     `json:"tool_call_id,omitempty"`  // role=tool 时关联的调用 ID
	ToolName     string     `json:"name,omitempty"`          // role=tool 时工具名
}

type LLMResponse struct {
	Content string
	Usage   struct {
		PromptTokens     int
		CompletionTokens int
	}
}

type StreamChunk struct {
	Content string
	Done    bool
	Error   error

	// 进度事件（P1: tool use 期间推送给前端，让用户知道"正在搜索..."等）
	Event *StreamEvent
}

// StreamEvent 是流式响应中的非内容事件（工具进度、工具结果）。
type StreamEvent struct {
	Type string `json:"type"` // "tool_call" | "tool_result" | "assistant_message"
	Data any    `json:"data"`
}

type LLMService struct {
	apiKey  string
	baseURL string
	model   string
	client  *http.Client
}

func NewLLMService(apiKey, baseURL, model string) *LLMService {
	return &LLMService{
		apiKey:  apiKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		model:   model,
		client:  &http.Client{},
	}
}

type chatRequest struct {
	Model    string       `json:"model"`
	Messages []chatMsg    `json:"messages"`
	Stream   bool         `json:"stream,omitempty"`
	Tools    []chatTool   `json:"tools,omitempty"`
}

type chatMsg struct {
	Role       string         `json:"role"`
	Content    string         `json:"content,omitempty"`
	ToolCalls  []chatToolCall `json:"tool_calls,omitempty"`
	ToolCallID string         `json:"tool_call_id,omitempty"` // role=tool 时关联的调用 ID
	Name       string         `json:"name,omitempty"`         // role=tool 时工具名
}

// chatTool 符合 OpenAI tools 数组格式。
type chatTool struct {
	Type     string             `json:"type"` // "function"
	Function chatToolFunction   `json:"function"`
}

type chatToolFunction struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

// chatToolCall 是 LLM 返回的工具调用请求。
type chatToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"` // "function"
	Function struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"` // 字符串化的 JSON
} `json:"function"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Role      string         `json:"role"`
			Content   string         `json:"content"`
			ToolCalls []chatToolCall `json:"tool_calls"`
		} `json:"message"`
		Delta struct {
			Content   string         `json:"content"`
			ToolCalls []chatToolCall `json:"tool_calls"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason"` // "stop" | "tool_calls" | "length"
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
}

func (s *LLMService) buildMessages(systemPrompt string, messages []LLMMessage) []chatMsg {
	msgs := []chatMsg{{Role: "system", Content: systemPrompt}}
	for _, m := range messages {
		cm := chatMsg{
			Role:       m.Role,
			Content:    m.Content,
			ToolCallID: m.ToolCallID,
			Name:       m.ToolName,
		}
		if len(m.ToolCalls) > 0 {
			cm.ToolCalls = make([]chatToolCall, 0, len(m.ToolCalls))
			for _, tc := range m.ToolCalls {
				raw := chatToolCall{ID: tc.ID, Type: "function"}
				raw.Function.Name = tc.Name
				raw.Function.Arguments = tc.ArgsJSON
				cm.ToolCalls = append(cm.ToolCalls, raw)
			}
		}
		msgs = append(msgs, cm)
	}
	return msgs
}

// ChatWithToolsResult 是一次工具对话的返回。
type ChatWithToolsResult struct {
	Content      string         // LLM 最终回复（文本部分）
	ToolCalls    []ToolCall     // LLM 请求调用的工具
	FinishReason string         // "stop" 表示直接回复；"tool_calls" 表示请求工具
	Usage        LLMTokenUsage  // token 用量
}

type LLMTokenUsage struct {
	PromptTokens     int
	CompletionTokens int
}

// ChatWithTools 与 Chat 类似，但额外支持传入 tools 定义和工具消息历史。
// 当 LLM 决定调用工具时，返回 FinishReason="tool_calls" + ToolCalls，
// 由调用方执行工具后再次调用本方法（带上工具结果）以获得最终回复。
func (s *LLMService) ChatWithTools(systemPrompt string, messages []LLMMessage, tools []OpenAITool) (*ChatWithToolsResult, error) {
	if s.apiKey == "" {
		// 没配置 key 时返回 mock，且假装 LLM 选择"直接回复"
		return &ChatWithToolsResult{
			Content:      "[Mock] 我是一段模拟回复。配置 LLM_API_KEY 以启用真实对话与工具调用。",
			FinishReason: "stop",
		}, nil
	}

	req := chatRequest{
		Model:    s.model,
		Messages: s.buildMessages(systemPrompt, messages),
	}
	if len(tools) > 0 {
		rawTools := make([]chatTool, 0, len(tools))
		for _, t := range tools {
			rawTools = append(rawTools, chatTool{
				Type: t.Type,
				Function: chatToolFunction{
					Name:        t.Function.Name,
					Description: t.Function.Description,
					Parameters:  t.Function.Parameters,
				},
			})
		}
		req.Tools = rawTools
	}

	body, _ := json.Marshal(req)
	httpReq, _ := http.NewRequest("POST", s.baseURL+"/chat/completions", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("LLM request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("LLM returned %d: %s", resp.StatusCode, string(b))
	}

	var result chatResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode LLM response: %w", err)
	}
	if len(result.Choices) == 0 {
		return nil, fmt.Errorf("LLM returned no choices")
	}

	choice := result.Choices[0]
	out := &ChatWithToolsResult{
		Content:      choice.Message.Content,
		FinishReason: choice.FinishReason,
		Usage: LLMTokenUsage{
			PromptTokens:     result.Usage.PromptTokens,
			CompletionTokens: result.Usage.CompletionTokens,
		},
	}
	for _, tc := range choice.Message.ToolCalls {
		out.ToolCalls = append(out.ToolCalls, ToolCall{
			ID:       tc.ID,
			Name:     tc.Function.Name,
			ArgsJSON: tc.Function.Arguments,
		})
	}
	return out, nil
}

func (s *LLMService) Chat(systemPrompt string, messages []LLMMessage) (*LLMResponse, error) {
	if s.apiKey == "" {
		return &LLMResponse{Content: "[Mock] 我是一段模拟回复。配置 LLM_API_KEY 以启用真实对话。"}, nil
	}

	body, _ := json.Marshal(chatRequest{
		Model:    s.model,
		Messages: s.buildMessages(systemPrompt, messages),
	})

	req, _ := http.NewRequest("POST", s.baseURL+"/chat/completions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("LLM request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("LLM returned %d: %s", resp.StatusCode, string(b))
	}

	var result chatResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode LLM response: %w", err)
	}

	if len(result.Choices) == 0 {
		return nil, fmt.Errorf("LLM returned no choices")
	}

	return &LLMResponse{
		Content: result.Choices[0].Message.Content,
		Usage: struct {
			PromptTokens     int
			CompletionTokens int
		}{
			PromptTokens:     result.Usage.PromptTokens,
			CompletionTokens: result.Usage.CompletionTokens,
		},
	}, nil
}

func (s *LLMService) ChatStream(systemPrompt string, messages []LLMMessage) (<-chan StreamChunk, error) {
	ch := make(chan StreamChunk, 64)

	if s.apiKey == "" {
		go func() {
			ch <- StreamChunk{Content: "[Mock] 我是一段模拟回复。配置 LLM_API_KEY 以启用真实对话。"}
			ch <- StreamChunk{Done: true}
			close(ch)
		}()
		return ch, nil
	}

	body, _ := json.Marshal(chatRequest{
		Model:    s.model,
		Messages: s.buildMessages(systemPrompt, messages),
		Stream:   true,
	})

	req, _ := http.NewRequest("POST", s.baseURL+"/chat/completions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		close(ch)
		return nil, fmt.Errorf("LLM stream request failed: %w", err)
	}

	go func() {
		defer close(ch)
		defer resp.Body.Close()

		scanner := bufio.NewScanner(resp.Body)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

		for scanner.Scan() {
			line := scanner.Text()
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				ch <- StreamChunk{Done: true}
				return
			}

			var result chatResponse
			if err := json.Unmarshal([]byte(data), &result); err != nil {
				continue
			}
			if len(result.Choices) > 0 {
				content := result.Choices[0].Delta.Content
				if content != "" {
					ch <- StreamChunk{Content: content}
				}
				if result.Choices[0].FinishReason == "stop" {
					ch <- StreamChunk{Done: true}
					return
				}
			}
		}

		if err := scanner.Err(); err != nil {
			ch <- StreamChunk{Error: err}
		}
	}()

	return ch, nil
}
