package service

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/wanye/ideaevo/internal/model"
)

// fakeTool 是用于测试的桩实现。
type fakeTool struct {
	name   string
	desc   string
	params json.RawMessage
	out    *ToolResult
	err    error
}

func (t *fakeTool) Name() string                    { return t.name }
func (t *fakeTool) Description() string             { return t.desc }
func (t *fakeTool) Parameters() json.RawMessage     { return t.params }
func (t *fakeTool) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	return t.out, t.err
}

func TestToolRegistry_RegisterAndGet(t *testing.T) {
	r := NewToolRegistry()
	tool := &fakeTool{name: "foo", desc: "foo tool", params: rawJSON(map[string]any{"type": "object"})}
	r.Register(tool)

	got, ok := r.Get("foo")
	if !ok {
		t.Fatal("expected to find registered tool")
	}
	if got.Name() != "foo" {
		t.Errorf("got name %q, want foo", got.Name())
	}

	if _, ok := r.Get("nonexistent"); ok {
		t.Error("expected nonexistent tool to be missing")
	}
}

func TestToolRegistry_DuplicateRegisterPanics(t *testing.T) {
	r := NewToolRegistry()
	r.Register(&fakeTool{name: "dup"})
	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic on duplicate registration")
		}
	}()
	r.Register(&fakeTool{name: "dup"})
}

func TestToolRegistry_Execute(t *testing.T) {
	r := NewToolRegistry()
	r.Register(&fakeTool{
		name: "echo",
		out:  &ToolResult{OK: true, Data: "hello"},
	})

	res, err := r.Execute(context.Background(), "echo", Principal{}, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.OK || res.Data != "hello" {
		t.Errorf("got %+v, want OK with hello", res)
	}

	// unknown tool 返回 OK=false，不返回 error
	res, err = r.Execute(context.Background(), "missing", Principal{}, nil)
	if err != nil {
		t.Errorf("unknown tool should not return system error, got %v", err)
	}
	if res.OK {
		t.Error("expected OK=false for unknown tool")
	}
}

func TestToolExecutor_ToolsDefinition_FilterByAllowList(t *testing.T) {
	r := NewToolRegistry()
	r.Register(&fakeTool{name: "alpha", desc: "a", params: rawJSON(map[string]any{"type": "object"})})
	r.Register(&fakeTool{name: "beta", desc: "b", params: rawJSON(map[string]any{"type": "object"})})
	r.Register(&fakeTool{name: "gamma", desc: "g", params: rawJSON(map[string]any{"type": "object"})})

	exec := NewToolExecutor(r)

	// 全部
	all := exec.ToolsDefinition(nil)
	if len(all) != 3 {
		t.Errorf("expected 3 tools, got %d", len(all))
	}

	// 白名单
	filtered := exec.ToolsDefinition([]string{"alpha", "gamma"})
	if len(filtered) != 2 {
		t.Fatalf("expected 2 filtered tools, got %d", len(filtered))
	}
	for _, td := range filtered {
		if td.Function.Name == "beta" {
			t.Error("beta should be filtered out")
		}
	}
}

func TestToolExecutor_ExecuteBatch_InvalidArgs(t *testing.T) {
	r := NewToolRegistry()
	r.Register(&fakeTool{name: "ok_tool", out: &ToolResult{OK: true}})
	exec := NewToolExecutor(r)

	// 第一条：参数格式错误
	// 第二条：正常
	calls := []ToolCall{
		{ID: "c1", Name: "ok_tool", ArgsJSON: json.RawMessage(`{invalid json`)},
		{ID: "c2", Name: "ok_tool", ArgsJSON: json.RawMessage(`{"k":"v"}`)},
	}

	results, err := exec.ExecuteBatch(context.Background(), Principal{}, calls)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	// 第一条应该是 OK=false
	if results[0].OK {
		t.Error("expected first result to be failure (invalid args)")
	}

	// 第二条应该成功
	if !results[1].OK {
		t.Error("expected second result to succeed")
	}
}

func TestToolExecutor_ExecuteBatch_SystemError(t *testing.T) {
	r := NewToolRegistry()
	r.Register(&fakeTool{name: "boom", err: errors.New("db down")})
	exec := NewToolExecutor(r)

	calls := []ToolCall{{ID: "c1", Name: "boom", ArgsJSON: json.RawMessage(`{}`)}}
	results, err := exec.ExecuteBatch(context.Background(), Principal{}, calls)
	if err != nil {
		t.Fatalf("system error should be swallowed into result, got %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].OK {
		t.Error("expected failure due to system error")
	}
}

// ---- capability & principal helpers ----

func TestRequireAuthor(t *testing.T) {
	// 1. 有 agent ID
	id, err := requireAuthor(Principal{AgentID: "agent-123"})
	if err != nil || id != "agent-123" {
		t.Errorf("agent case: id=%q err=%v", id, err)
	}

	// 2. 仅 user ID，无 system assistant 标记 → 拒绝
	_, err = requireAuthor(Principal{UserID: "user-456"})
	if err == nil {
		t.Error("expected error for non-system-assistant user")
	}

	// 3. system assistant 未就绪 → 拒绝写操作
	_, err = requireAuthor(Principal{UserID: "user-456", AgentID: "sys", IsSystemAssistant: true})
	if err == nil {
		t.Error("expected error when AuthorAgentReady is false")
	}

	// 4. system assistant 已绑定用户 Agent
	id, err = requireAuthor(Principal{
		UserID:            "user-456",
		AgentID:           "agent-default",
		IsSystemAssistant: true,
		AuthorAgentReady:  true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if id != "agent-default" {
		t.Errorf("got %q, want agent-default", id)
	}
}

func TestCanAgentUseTool_NoCapabilitiesMeansAllAllowed(t *testing.T) {
	agent := &model.Agent{Name: "any-agent", Capabilities: ""}
	if !canAgentUseTool(agent, "anything") {
		t.Error("agent without capabilities should be allowed to use any tool")
	}
}

func TestCanAgentUseTool_WithCapabilitiesWhitelist(t *testing.T) {
	agent := &model.Agent{
		Name:         "limited-agent",
		Capabilities: `["search_ideas","query_ideas"]`,
	}
	if !canAgentUseTool(agent, "search_ideas") {
		t.Error("search_ideas should be allowed")
	}
	if canAgentUseTool(agent, "register_idea") {
		t.Error("register_idea should NOT be allowed")
	}
}

func TestCanAgentUseTool_SystemAssistantBypass(t *testing.T) {
	agent := &model.Agent{Name: SystemAssistantName, Capabilities: "[]"}
	// 内置助手即便 capabilities 为空数组，也应能使用 SystemCapabilities 列出的工具
	if !canAgentUseTool(agent, "search_ideas") {
		t.Error("system assistant should be able to use search_ideas")
	}
	if canAgentUseTool(agent, "some_unknown_tool") {
		t.Error("system assistant should NOT be able to use unknown tools")
	}
}

// ---- input parsing helpers ----

func TestToolStrReq(t *testing.T) {
	if _, err := ToolStrReq(ToolInput{}, "k"); err == nil {
		t.Error("expected error for missing key")
	}
	if _, err := ToolStrReq(ToolInput{"k": ""}, "k"); err == nil {
		t.Error("expected error for empty string")
	}
	v, err := ToolStrReq(ToolInput{"k": "val"}, "k")
	if err != nil || v != "val" {
		t.Errorf("got v=%q err=%v", v, err)
	}
	// 非字符串
	if _, err := ToolStrReq(ToolInput{"k": 123}, "k"); err == nil {
		t.Error("expected error for non-string value")
	}
}

func TestToolInt(t *testing.T) {
	if v := ToolInt(ToolInput{"n": float64(42)}, "n"); v != 42 {
		t.Errorf("got %d, want 42", v)
	}
	if v := ToolInt(ToolInput{}, "n"); v != 0 {
		t.Errorf("got %d, want 0", v)
	}
}

func TestToolStrSlice(t *testing.T) {
	in := ToolInput{"tags": []any{"a", "b", "c"}}
	got := ToolStrSlice(in, "tags")
	if len(got) != 3 || got[0] != "a" || got[2] != "c" {
		t.Errorf("got %v, want [a b c]", got)
	}
	if ToolStrSlice(ToolInput{}, "tags") != nil {
		t.Error("expected nil for missing key")
	}
}

// ---- 二次确认机制 ----

// newWriteToolExecutor 构造一个测试用的 executor，注册一个名为 register_idea 的写工具。
// 因为 IsWriteTool 通过名字识别，所以工具名必须匹配。
func newWriteToolExecutor(t *testing.T, executed *bool) *ToolExecutor {
	r := NewToolRegistry()
	r.Register(&fakeTool{
		name:   "register_idea",
		desc:   "test register",
		params: rawJSON(map[string]any{"type": "object"}),
		out:    &ToolResult{OK: true, Data: "created"},
	})
	exec := NewToolExecutor(r)
	// 用 wrapped fakeTool 记录执行
	r2 := NewToolRegistry()
	r2.Register(&writeToolStub{executed: executed})
	// 替换内部 registry
	exec.registry = r2
	return exec
}

type writeToolStub struct{ executed *bool }

func (t *writeToolStub) Name() string                        { return "register_idea" }
func (t *writeToolStub) Description() string                 { return "stub" }
func (t *writeToolStub) Parameters() json.RawMessage         { return rawJSON(map[string]any{"type": "object"}) }
func (t *writeToolStub) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	*t.executed = true
	return &ToolResult{OK: true, Data: "created"}, nil
}

func TestWriteToolConfirmation_RequiresConfirm(t *testing.T) {
	var executed bool
	exec := newWriteToolExecutor(t, &executed)
	p := Principal{AgentID: "agent-A"}

	// 第一次调用：不带 confirm → 应拦截
	args, _ := json.Marshal(map[string]any{"title": "X"})
	calls := []ToolCall{{ID: "c1", Name: "register_idea", ArgsJSON: args}}

	results, err := exec.ExecuteBatch(context.Background(), p, calls)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("want 1 result, got %d", len(results))
	}
	if results[0].OK {
		t.Error("first call should not succeed (needs confirmation)")
	}
	if executed {
		t.Error("tool should NOT have been executed on first call")
	}

	// 输出中应包含 token（"confirm=" 后跟十六进制）
	if !contains(results[0].Output, "need_confirmation") {
		t.Errorf("output should mention need_confirmation, got: %s", results[0].Output)
	}
}

func TestWriteToolConfirmation_ConsumesTokenAndExecutes(t *testing.T) {
	var executed bool
	exec := newWriteToolExecutor(t, &executed)
	p := Principal{AgentID: "agent-A"}

	// 第一次调用：拿 token
	args1, _ := json.Marshal(map[string]any{"title": "X"})
	res1, _ := exec.ExecuteBatch(context.Background(), p, []ToolCall{{ID: "c1", Name: "register_idea", ArgsJSON: args1}})
	token := extractConfirmToken(t, res1[0].Output)
	if token == "" {
		t.Fatal("could not extract token from first call output")
	}

	// 第二次调用：带 confirm=token，参数完全一致 → 应执行
	args2, _ := json.Marshal(map[string]any{"title": "X", "confirm": token})
	res2, err := exec.ExecuteBatch(context.Background(), p, []ToolCall{{ID: "c2", Name: "register_idea", ArgsJSON: args2}})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !res2[0].OK {
		t.Errorf("second call should succeed, got: %s", res2[0].Output)
	}
	if !executed {
		t.Error("tool should have been executed after confirmation")
	}
}

func TestWriteToolConfirmation_RejectsTamperedArgs(t *testing.T) {
	var executed bool
	exec := newWriteToolExecutor(t, &executed)
	p := Principal{AgentID: "agent-A"}

	// 第一次：title=X
	args1, _ := json.Marshal(map[string]any{"title": "X"})
	res1, _ := exec.ExecuteBatch(context.Background(), p, []ToolCall{{ID: "c1", Name: "register_idea", ArgsJSON: args1}})
	token := extractConfirmToken(t, res1[0].Output)

	// 第二次：title=Y（被篡改）但复用同一 token → 应拒绝
	args2, _ := json.Marshal(map[string]any{"title": "Y", "confirm": token})
	res2, _ := exec.ExecuteBatch(context.Background(), p, []ToolCall{{ID: "c2", Name: "register_idea", ArgsJSON: args2}})
	if res2[0].OK {
		t.Error("should reject tampered args")
	}
	if executed {
		t.Error("tool should NOT execute on tampered args")
	}
}

func TestWriteToolConfirmation_RejectsTokenFromDifferentPrincipal(t *testing.T) {
	var executed bool
	exec := newWriteToolExecutor(t, &executed)
	p1 := Principal{AgentID: "agent-A"}
	p2 := Principal{AgentID: "agent-B"}

	args1, _ := json.Marshal(map[string]any{"title": "X"})
	res1, _ := exec.ExecuteBatch(context.Background(), p1, []ToolCall{{ID: "c1", Name: "register_idea", ArgsJSON: args1}})
	token := extractConfirmToken(t, res1[0].Output)

	args2, _ := json.Marshal(map[string]any{"title": "X", "confirm": token})
	res2, _ := exec.ExecuteBatch(context.Background(), p2, []ToolCall{{ID: "c2", Name: "register_idea", ArgsJSON: args2}})
	if res2[0].OK {
		t.Error("should reject token from different principal")
	}
}

func TestReadToolSkipsConfirmation(t *testing.T) {
	// 读工具（非 IsWriteTool）不应被二次确认拦截
	r := NewToolRegistry()
	var executed bool
	r.Register(&readToolStub{executed: &executed})
	exec := NewToolExecutor(r)

	args, _ := json.Marshal(map[string]any{"query": "test"})
	res, err := exec.ExecuteBatch(context.Background(), Principal{}, []ToolCall{{ID: "c1", Name: "search_ideas", ArgsJSON: args}})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !res[0].OK {
		t.Error("read tool should succeed without confirmation")
	}
	if !executed {
		t.Error("read tool should have executed")
	}
}

type readToolStub struct{ executed *bool }

func (t *readToolStub) Name() string                        { return "search_ideas" }
func (t *readToolStub) Description() string                 { return "stub" }
func (t *readToolStub) Parameters() json.RawMessage         { return rawJSON(map[string]any{"type": "object"}) }
func (t *readToolStub) Execute(ctx context.Context, p Principal, in ToolInput) (*ToolResult, error) {
	*t.executed = true
	return &ToolResult{OK: true}, nil
}

// contains 是简化的 strings.Contains（避免额外 import）。
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || indexOf(s, substr) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

// extractConfirmToken 从 "confirm=..." 这样的输出文本中提取 token。
// 输出可能经过 JSON 编码（引号被转义为 \"），所以两种形式都尝试。
func extractConfirmToken(t *testing.T, output string) string {
	t.Helper()
	// 尝试两种形式：confirm="token" 或 confirm=\"token\"
	for _, needle := range []string{`confirm="`, `confirm=\"`} {
		i := indexOf(output, needle)
		if i < 0 {
			continue
		}
		start := i + len(needle)
		end := start
		for end < len(output) && output[end] != '"' && output[end] != '\\' {
			end++
		}
		if end > start {
			return output[start:end]
		}
	}
	return ""
}
