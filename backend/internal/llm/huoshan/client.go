package huoshan

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	arkruntime "github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
	"github.com/wanye/ideaevo/internal/llm"
)

const (
	defaultArkBaseURL  = "https://ark.cn-beijing.volces.com"
	defaultArkAPIPath  = "/api/v3"
	defaultTextModel   = "doubao-seed-2-0-lite-260215"
	defaultHTTPTimeout = 120 * time.Second
)

// Config holds Huoshan (Volcengine Ark) credentials — aligned with grapery/internal/genai.
type Config struct {
	APIKey    string
	BaseURL   string
	TextModel string
	Timeout   time.Duration
}

// Client wraps the official arkruntime SDK for chat completions.
type Client struct {
	config    Config
	model     string
	baseURL   string
	arkClient *arkruntime.Client
}

// New constructs a Huoshan client with sane defaults.
func New(cfg Config) *Client {
	if cfg.Timeout == 0 {
		cfg.Timeout = defaultHTTPTimeout
	}
	httpClient := &http.Client{Timeout: cfg.Timeout}
	opts := []arkruntime.ConfigOption{
		arkruntime.WithHTTPClient(httpClient),
		arkruntime.WithTimeout(cfg.Timeout),
		arkruntime.WithBaseUrl(resolveArkBaseURL(cfg.BaseURL)),
	}
	model := strings.TrimSpace(choose(cfg.TextModel, defaultTextModel))
	return &Client{
		config:    cfg,
		model:     model,
		baseURL:   resolveArkBaseURL(cfg.BaseURL),
		arkClient: arkruntime.NewClientWithApiKey(cfg.APIKey, opts...),
	}
}

func (c *Client) Model() string  { return c.model }
func (c *Client) BaseURL() string { return c.baseURL }

func resolveArkBaseURL(baseURL string) string {
	base := strings.TrimSpace(baseURL)
	if base == "" {
		base = defaultArkBaseURL
	}
	base = strings.TrimSuffix(base, "/")
	if strings.HasSuffix(base, defaultArkAPIPath) {
		return base
	}
	if strings.Contains(base, "/api/") {
		return base
	}
	return base + defaultArkAPIPath
}

func choose(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

// ChatMessage is provider-neutral input for chat completions.
type ChatMessage struct {
	Role       string
	Content    string
	ToolCalls  []ToolCall
	ToolCallID string
	ToolName   string
}

type ToolCall struct {
	ID       string
	Name     string
	ArgsJSON json.RawMessage
}

type Tool struct {
	Type       string
	Name       string
	Description string
	Parameters json.RawMessage
}

type ChatResult struct {
	Content      string
	ToolCalls    []ToolCall
	FinishReason string
	PromptTokens int
	CompletionTokens int
}

// ChatWithTools calls Ark chat completions with optional tools.
func (c *Client) ChatWithTools(ctx context.Context, messages []ChatMessage, tools []Tool) (*ChatResult, error) {
	if strings.TrimSpace(c.model) == "" {
		return nil, llm.ErrMissingModel("ark", c.baseURL)
	}
	req := arkmodel.CreateChatCompletionRequest{
		Model:    c.model,
		Messages: toArkMessages(messages),
	}
	if len(tools) > 0 {
		req.Tools = toArkTools(tools)
	}
	resp, err := c.arkClient.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, llm.WrapArkError("ark", c.model, c.baseURL, err)
	}
	return arkResponseToResult(resp), nil
}

// ChatStream streams chat completion tokens.
func (c *Client) ChatStream(ctx context.Context, messages []ChatMessage, onChunk func(content string) error) error {
	if strings.TrimSpace(c.model) == "" {
		return llm.ErrMissingModel("ark", c.baseURL)
	}
	req := arkmodel.CreateChatCompletionRequest{
		Model:    c.model,
		Messages: toArkMessages(messages),
	}
	stream, err := c.arkClient.CreateChatCompletionStream(ctx, req)
	if err != nil {
		return llm.WrapArkError("ark", c.model, c.baseURL, err)
	}
	defer stream.Close()

	for {
		recv, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return llm.WrapArkError("ark", c.model, c.baseURL, err)
		}
		if len(recv.Choices) == 0 {
			continue
		}
		content := strings.TrimSpace(recv.Choices[0].Delta.Content)
		if content != "" && onChunk != nil {
			if err := onChunk(content); err != nil {
				return err
			}
		}
		if recv.Choices[0].FinishReason == "stop" {
			return nil
		}
	}
}

func toArkMessages(messages []ChatMessage) []*arkmodel.ChatCompletionMessage {
	out := make([]*arkmodel.ChatCompletionMessage, 0, len(messages))
	for _, m := range messages {
		msg := &arkmodel.ChatCompletionMessage{
			Role: m.Role,
		}
		if m.Role == "tool" {
			msg.ToolCallID = m.ToolCallID
			if m.ToolName != "" {
				msg.Name = &m.ToolName
			}
		}
		if m.Content != "" {
			msg.Content = &arkmodel.ChatCompletionMessageContent{StringValue: &m.Content}
		}
		if len(m.ToolCalls) > 0 {
			msg.ToolCalls = make([]*arkmodel.ToolCall, 0, len(m.ToolCalls))
			for _, tc := range m.ToolCalls {
				args := string(tc.ArgsJSON)
				msg.ToolCalls = append(msg.ToolCalls, &arkmodel.ToolCall{
					ID:   tc.ID,
					Type: arkmodel.ToolTypeFunction,
					Function: arkmodel.FunctionCall{
						Name:      tc.Name,
						Arguments: args,
					},
				})
			}
		}
		out = append(out, msg)
	}
	return out
}

func toArkTools(tools []Tool) []*arkmodel.Tool {
	out := make([]*arkmodel.Tool, 0, len(tools))
	for _, t := range tools {
		var params interface{}
		if len(t.Parameters) > 0 {
			_ = json.Unmarshal(t.Parameters, &params)
		}
		out = append(out, &arkmodel.Tool{
			Type: arkmodel.ToolTypeFunction,
			Function: &arkmodel.FunctionDefinition{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  params,
			},
		})
	}
	return out
}

func arkResponseToResult(resp arkmodel.ChatCompletionResponse) *ChatResult {
	result := &ChatResult{
		PromptTokens:     resp.Usage.PromptTokens,
		CompletionTokens: resp.Usage.CompletionTokens,
	}
	if len(resp.Choices) == 0 {
		return result
	}
	choice := resp.Choices[0]
	result.FinishReason = string(choice.FinishReason)
	result.Content = extractAssistantText(choice.Message)
	for _, tc := range choice.Message.ToolCalls {
		if tc == nil {
			continue
		}
		result.ToolCalls = append(result.ToolCalls, ToolCall{
			ID:       tc.ID,
			Name:     tc.Function.Name,
			ArgsJSON: json.RawMessage(tc.Function.Arguments),
		})
	}
	return result
}

func extractAssistantText(msg arkmodel.ChatCompletionMessage) string {
	if msg.Content == nil {
		return ""
	}
	if msg.Content.StringValue != nil {
		return strings.TrimSpace(*msg.Content.StringValue)
	}
	if len(msg.Content.ListValue) == 0 {
		return ""
	}
	var b strings.Builder
	for _, p := range msg.Content.ListValue {
		if p == nil {
			continue
		}
		if p.Type == arkmodel.ChatCompletionMessageContentPartTypeText && strings.TrimSpace(p.Text) != "" {
			if b.Len() > 0 {
				b.WriteString("\n")
			}
			b.WriteString(strings.TrimSpace(p.Text))
		}
	}
	return strings.TrimSpace(b.String())
}

// ValidateConfig returns an error if API key or model is missing.
func ValidateConfig(cfg Config) error {
	if strings.TrimSpace(cfg.APIKey) == "" {
		return fmt.Errorf("huoshan api key is required")
	}
	model := strings.TrimSpace(choose(cfg.TextModel, defaultTextModel))
	if model == "" {
		return llm.ErrMissingModel("ark", resolveArkBaseURL(cfg.BaseURL))
	}
	return nil
}
