package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

// Principal 表示一次工具调用的执行主体。
// 同一份 Tool 实现可服务于多种入口（MCP / REST / agent-bridge），
// 区别仅在 Principal：MCP 用 AgentID+APIKey，页面用 UserID+SessionID。
type Principal struct {
	// 来源入口
	Source string // "mcp" | "rest" | "agent_bridge"

	// 身份（至少其中之一非空）
	UserID   string // 页面登录用户
	AgentID  string // 已认证的 agent

	// 会话上下文（用于工具回写活动日志、关联资源）
	SessionID string
	IdeaID    string // 当前会话绑定的 idea（若有）

	// 可选：是否为平台内置助手（拥有更广权限，如代用户操作）
	IsSystemAssistant bool
	// AuthorAgentReady 为 true 表示 IsSystemAssistant 场景下已绑定用户默认 Agent（可写）。
	AuthorAgentReady bool
}

// ToolInput 是工具收到的参数集合（来自 LLM tool_call.arguments 或 MCP 入参）。
type ToolInput map[string]any

// ToolResult 是工具执行的结果，将被序列化为文本回灌给 LLM。
// Data 用于 LLM 上下文（JSON 字符串）；Display 可选，用于在 UI 上展示卡片。
type ToolResult struct {
	OK      bool        `json:"ok"`
	Data    any         `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Display *ToolDisplay `json:"display,omitempty"` // 可选：UI 渲染提示
}

// ToolDisplay 给前端的渲染提示（如展示一个 idea 卡片列表）。
type ToolDisplay struct {
	Kind string `json:"kind"` // "idea_list" | "idea_detail" | "confirmation" | ...
	Ref  string `json:"ref"`  // 关联资源 ID 或 JSON
}

// Tool 是所有平台工具的统一抽象。
// 实现方通常是 *IdeaService / *SocialService 等业务服务的薄封装。
type Tool interface {
	// Name 工具名（snake_case，与 OpenAI tool name 一致）
	Name() string
	// Description 给 LLM 看的功能描述（决定 LLM 何时调用）
	Description() string
	// Parameters JSON Schema 描述参数（用于 LLM tool 定义）
	Parameters() json.RawMessage
	// Execute 执行工具。error 表示系统错误；ToolResult.OK=false 表示业务失败（仍会回给 LLM）。
	Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error)
}

// ToolRegistry 维护所有可用工具，按名字查找。
// 设计为并发安全：注册在启动时完成，运行时只读。
type ToolRegistry struct {
	mu    sync.RWMutex
	tools map[string]Tool
}

func NewToolRegistry() *ToolRegistry {
	return &ToolRegistry{tools: make(map[string]Tool)}
}

// Register 注册一个工具。重复名注册会 panic（启动期错误）。
func (r *ToolRegistry) Register(t Tool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	name := t.Name()
	if _, exists := r.tools[name]; exists {
		panic(fmt.Sprintf("tool %q already registered", name))
	}
	r.tools[name] = t
}

// Get 按名查找工具。
func (r *ToolRegistry) Get(name string) (Tool, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	t, ok := r.tools[name]
	return t, ok
}

// List 返回所有工具（用于生成 LLM tools 定义、MCP 自描述）。
func (r *ToolRegistry) List() []Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Tool, 0, len(r.tools))
	for _, t := range r.tools {
		out = append(out, t)
	}
	return out
}

// Names 返回所有工具名（用于权限白名单校验等）。
func (r *ToolRegistry) Names() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]string, 0, len(r.tools))
	for name := range r.tools {
		out = append(out, name)
	}
	return out
}

// GetByNames 按名称列表批量获取工具。不存在的名称跳过。
func (r *ToolRegistry) GetByNames(names []string) []Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Tool, 0, len(names))
	for _, name := range names {
		if t, ok := r.tools[name]; ok {
			out = append(out, t)
		}
	}
	return out
}

// Execute 便捷方法：查找并执行工具。
func (r *ToolRegistry) Execute(ctx context.Context, name string, p Principal, in ToolInput) (*ToolResult, error) {
	t, ok := r.Get(name)
	if !ok {
		return &ToolResult{OK: false, Error: fmt.Sprintf("unknown tool: %s", name)}, nil
	}
	return t.Execute(ctx, p, in)
}

// ---- helpers for tool input parsing ----

// ToolStr 取字符串参数（缺失返回 ""）。
func ToolStr(in ToolInput, key string) string {
	if v, ok := in[key].(string); ok {
		return v
	}
	return ""
}

// ToolStrReq 取必填字符串参数；缺失返回 error。
func ToolStrReq(in ToolInput, key string) (string, error) {
	v, ok := in[key].(string)
	if !ok || strings.TrimSpace(v) == "" {
		return "", fmt.Errorf("parameter %q is required", key)
	}
	return v, nil
}

// ToolInt 取整数参数。
func ToolInt(in ToolInput, key string) int {
	switch v := in[key].(type) {
	case float64:
		return int(v)
	case int:
		return v
	}
	return 0
}

// ToolFloat 取浮点参数。
func ToolFloat(in ToolInput, key string) float64 {
	if v, ok := in[key].(float64); ok {
		return v
	}
	return 0
}

// ToolBool 取布尔参数。
func ToolBool(in ToolInput, key string) bool {
	switch v := in[key].(type) {
	case bool:
		return v
	case string:
		return v == "true" || v == "1"
	}
	return false
}

// ToolStrSlice 取字符串切片参数。
func ToolStrSlice(in ToolInput, key string) []string {
	arr, ok := in[key].([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(arr))
	for _, v := range arr {
		out = append(out, fmt.Sprintf("%v", v))
	}
	return out
}
