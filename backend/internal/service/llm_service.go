package service

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/wanye/ideaevo/internal/config"
	"github.com/wanye/ideaevo/internal/llm"
	"github.com/wanye/ideaevo/internal/llm/huoshan"
)

type LLMMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`

	// 工具调用相关（用于多轮 tool use 对话）
	ToolCalls    []ToolCall `json:"tool_calls,omitempty"`   // role=assistant 且 LLM 请求工具时
	ToolCallID   string     `json:"tool_call_id,omitempty"` // role=tool 时关联的调用 ID
	ToolName     string     `json:"name,omitempty"`         // role=tool 时工具名
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
	cfg     config.LLMConfig
	apiKey  string
	baseURL string
	model   string
	client  *http.Client
	ark     *huoshan.Client
}

func NewLLMService(cfg config.LLMConfig) *LLMService {
	s := &LLMService{
		cfg:     cfg,
		apiKey:  cfg.APIKey,
		baseURL: strings.TrimRight(cfg.BaseURL, "/"),
		model:   strings.TrimSpace(cfg.Model),
		client:  &http.Client{},
	}
	if cfg.Provider == "ark" && cfg.APIKey != "" {
		s.ark = huoshan.New(huoshan.Config{
			APIKey:    cfg.APIKey,
			BaseURL:   cfg.BaseURL,
			TextModel: cfg.Model,
		})
		s.model = s.ark.Model()
		s.baseURL = s.ark.BaseURL()
	}
	return s
}

type chatRequest struct {
	Model    string     `json:"model"`
	Messages []chatMsg  `json:"messages"`
	Stream   bool       `json:"stream,omitempty"`
	Tools    []chatTool `json:"tools,omitempty"`
}

type chatMsg struct {
	Role       string         `json:"role"`
	Content    string         `json:"content,omitempty"`
	ToolCalls  []chatToolCall `json:"tool_calls,omitempty"`
	ToolCallID string         `json:"tool_call_id,omitempty"`
	Name       string         `json:"name,omitempty"`
}

type chatTool struct {
	Type     string           `json:"type"`
	Function chatToolFunction `json:"function"`
}

type chatToolFunction struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

type chatToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
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
		FinishReason string `json:"finish_reason"`
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

func (s *LLMService) toHuoshanMessages(systemPrompt string, messages []LLMMessage) []huoshan.ChatMessage {
	out := []huoshan.ChatMessage{{Role: "system", Content: systemPrompt}}
	for _, m := range messages {
		hm := huoshan.ChatMessage{
			Role:       m.Role,
			Content:    m.Content,
			ToolCallID: m.ToolCallID,
			ToolName:   m.ToolName,
		}
		for _, tc := range m.ToolCalls {
			hm.ToolCalls = append(hm.ToolCalls, huoshan.ToolCall{
				ID:       tc.ID,
				Name:     tc.Name,
				ArgsJSON: tc.ArgsJSON,
			})
		}
		out = append(out, hm)
	}
	return out
}

func (s *LLMService) validateModel() error {
	if strings.TrimSpace(s.model) == "" {
		return llm.ErrMissingModel(s.cfg.Provider, s.baseURL)
	}
	return nil
}

// ChatWithToolsResult 是一次工具对话的返回。
type ChatWithToolsResult struct {
	Content      string
	ToolCalls    []ToolCall
	FinishReason string
	Usage        LLMTokenUsage
}

type LLMTokenUsage struct {
	PromptTokens     int
	CompletionTokens int
}

func (s *LLMService) ChatWithTools(systemPrompt string, messages []LLMMessage, tools []OpenAITool) (*ChatWithToolsResult, error) {
	if s.apiKey == "" {
		return &ChatWithToolsResult{
			Content:      "[Mock] 我是一段模拟回复。配置 LLM_API_KEY 以启用真实对话与工具调用。",
			FinishReason: "stop",
		}, nil
	}
	if err := s.validateModel(); err != nil {
		return nil, err
	}

	if s.ark != nil {
		return s.chatWithToolsArk(systemPrompt, messages, tools)
	}
	return s.chatWithToolsHTTP(systemPrompt, messages, tools)
}

func (s *LLMService) chatWithToolsArk(systemPrompt string, messages []LLMMessage, tools []OpenAITool) (*ChatWithToolsResult, error) {
	arkTools := make([]huoshan.Tool, 0, len(tools))
	for _, t := range tools {
		arkTools = append(arkTools, huoshan.Tool{
			Type:        t.Type,
			Name:        t.Function.Name,
			Description: t.Function.Description,
			Parameters:  t.Function.Parameters,
		})
	}
	resp, err := s.ark.ChatWithTools(context.Background(), s.toHuoshanMessages(systemPrompt, messages), arkTools)
	if err != nil {
		return nil, err
	}
	out := &ChatWithToolsResult{
		Content:      resp.Content,
		FinishReason: resp.FinishReason,
		Usage: LLMTokenUsage{
			PromptTokens:     resp.PromptTokens,
			CompletionTokens: resp.CompletionTokens,
		},
	}
	for _, tc := range resp.ToolCalls {
		out.ToolCalls = append(out.ToolCalls, ToolCall{
			ID:       tc.ID,
			Name:     tc.Name,
			ArgsJSON: tc.ArgsJSON,
		})
	}
	return out, nil
}

func (s *LLMService) chatWithToolsHTTP(systemPrompt string, messages []LLMMessage, tools []OpenAITool) (*ChatWithToolsResult, error) {
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
		return nil, fmt.Errorf("LLM request failed (provider=%s model=%s): %w", s.cfg.Provider, s.model, err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, llm.ParseHTTPError(s.cfg.Provider, s.model, s.baseURL, resp.StatusCode, respBody)
	}

	var result chatResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to decode LLM response (provider=%s): %w", s.cfg.Provider, err)
	}
	if len(result.Choices) == 0 {
		return nil, fmt.Errorf("LLM returned no choices (provider=%s model=%s)", s.cfg.Provider, s.model)
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
	result, err := s.ChatWithTools(systemPrompt, messages, nil)
	if err != nil {
		return nil, err
	}
	return &LLMResponse{
		Content: result.Content,
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
	if err := s.validateModel(); err != nil {
		close(ch)
		return nil, err
	}

	if s.ark != nil {
		go func() {
			defer close(ch)
			err := s.ark.ChatStream(context.Background(), s.toHuoshanMessages(systemPrompt, messages), func(content string) error {
				ch <- StreamChunk{Content: content}
				return nil
			})
			if err != nil {
				ch <- StreamChunk{Error: err}
				return
			}
			ch <- StreamChunk{Done: true}
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
		return nil, fmt.Errorf("LLM stream request failed (provider=%s model=%s): %w", s.cfg.Provider, s.model, err)
	}

	go func() {
		defer close(ch)
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(resp.Body)
			ch <- StreamChunk{Error: llm.ParseHTTPError(s.cfg.Provider, s.model, s.baseURL, resp.StatusCode, b)}
			return
		}

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
