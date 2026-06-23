// Package a2a 实现 Agent-to-Agent (A2A) 协议。
//
// A2A 是 Google 提出的开放协议，标准化不同 AI Agent 之间的发现、通信和协作。
// 本实现遵循 A2A v1.0 规范核心子集：
//   - Agent Card（发现）：GET /a2a/.well-known/agent.json
//   - tasks/send（同步）：POST /a2a  JSON-RPC method="tasks/send"
//   - tasks/sendSubscribe（流式）：POST /a2a  JSON-RPC method="tasks/sendSubscribe"
//   - tasks/get（状态）：POST /a2a  JSON-RPC method="tasks/get"
//
// 不依赖外部 A2A SDK，直接用 JSON-RPC 2.0 over HTTP 实现，
// 因为我们需要与现有 Gin 路由共享端口和中间件。
package a2a

import (
	"encoding/json"
	"time"
)

// ========================================
// A2A 协议类型（遵循 A2A v1.0 spec）
// ========================================

// AgentCard 是 Agent 发现端点返回的元数据。
type AgentCard struct {
	Name              string        `json:"name"`
	Description       string        `json:"description,omitempty"`
	URL               string        `json:"url"`                 // 本 Agent 的 A2A 端点
	Version           string        `json:"version"`
	Capabilities      Capabilities  `json:"capabilities"`
	DefaultInputModes []string      `json:"defaultInputModes"`
	DefaultOutputModes []string     `json:"defaultOutputModes"`
	Skills            []AgentSkill  `json:"skills,omitempty"`
}

// Capabilities 描述 Agent 支持的功能。
type Capabilities struct {
	Streaming         bool `json:"streaming"`
	PushNotifications bool `json:"pushNotifications"`
	StateTransition   bool `json:"stateTransition"`
}

// AgentSkill 描述 Agent 的一项能力。
type AgentSkill struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Tags        []string `json:"tags,omitempty"`
}

// TaskState 任务状态枚举。
type TaskState string

const (
	TaskStateSubmitted  TaskState = "submitted"
	TaskStateWorking    TaskState = "working"
	TaskStateInputReq   TaskState = "input-required"
	TaskStateCompleted  TaskState = "completed"
	TaskStateCanceled   TaskState = "canceled"
	TaskStateFailed     TaskState = "failed"
)

// Task 是 A2A 任务的完整表示。
type Task struct {
	ID        string     `json:"id"`
	State     TaskState  `json:"state"`
	Messages  []Message  `json:"messages,omitempty"`
	Artifacts []Artifact `json:"artifacts,omitempty"`
}

// Message 是任务中的一条消息。
type Message struct {
	Role     string `json:"role"`              // "user" | "agent"
	Parts    []Part `json:"parts"`
	MessageID string `json:"messageId"`
}

// Part 是消息的一部分（支持文本、文件等多模态）。
type Part struct {
	Type string `json:"type"`           // "text" | "file" | "data"
	Text string `json:"text,omitempty"`  // type=text 时
}

// Artifact 是任务产生的输出。
type Artifact struct {
	ArtifactID string `json:"artifactId"`
	Parts      []Part `json:"parts"`
}

// ========================================
// JSON-RPC 2.0 请求/响应
// ========================================

// JSONRPCRequest 是 JSON-RPC 2.0 请求体。
type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      any             `json:"id"`       // string | int
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

// JSONRPCResponse 是 JSON-RPC 2.0 响应体。
type JSONRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      any             `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *JSONRPCError   `json:"error,omitempty"`
}

// JSONRPCError 是 JSON-RPC 2.0 错误对象。
type JSONRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

// SendTaskParams 是 tasks/send / tasks/sendSubscribe 的参数。
type SendTaskParams struct {
	ID        string    `json:"id"`         // 客户端生成的任务 ID
	Message   Message   `json:"message"`    // 用户消息
	SessionID string    `json:"sessionId,omitempty"`
}

// GetTaskParams 是 tasks/get 的参数。
type GetTaskParams struct {
	ID           string `json:"id"`
	HistoryLength int   `json:"historyLength,omitempty"`
}

// ========================================
// A2A 错误码（遵循 spec 的 code 区间）
// ========================================

const (
	ErrCodeJSONParseError    = -32700
	ErrCodeInvalidRequest    = -32600
	ErrCodeMethodNotFound    = -32601
	ErrCodeInvalidParams     = -32602
	ErrCodeInternalError     = -32603
	ErrCodeTaskNotFound      = -32001
	ErrCodeTaskNotCancelable = -32002
	ErrCodePushNotSupported  = -32003
	ErrCodeUnsupportedOp     = -32004
)

// TaskHandler 是处理 A2A 任务的回调接口。
// 由调用方（ChatService）注入，负责实际的 Agent 执行。
type TaskHandler interface {
	// HandleTask 执行一个 A2A 任务，返回更新后的 Task。
	// streaming=true 时，通过 onChunk 回调推送流式文本。
	HandleTask(task *Task, agentID string, streaming bool, onChunk func(text string)) (*Task, error)
}

// SendTaskRequest 是 tasks/send 的完整 JSON-RPC 包装。
type SendTaskRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	ID      any           `json:"id"`
	Method  string        `json:"method"`
	Params  SendTaskParams `json:"params"`
}

// 通用工具
var _ = time.Now
