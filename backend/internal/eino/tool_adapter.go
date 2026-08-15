package eino

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/cloudwego/eino/components/tool"
	einoschema "github.com/cloudwego/eino/schema"
)

// Principal 是工具执行上下文中的身份信息。
// 这个类型与 service.Principal 字段完全一致，但定义在此包中以避免循环导入。
// service 层在调用 WrapToolsForEino 前会做转换。
type Principal struct {
	Source            string
	UserID            string
	AgentID           string
	SessionID         string
	IdeaID            string
	IsSystemAssistant bool
}

// ToolExecutor 是 ideaevo 平台工具的最小接口（与 service.Tool 兼容）。
// 避免直接导入 service 包造成循环依赖。
type ToolExecutor interface {
	Name() string
	Description() string
	Parameters() json.RawMessage
	Execute(ctx context.Context, principal Principal, input map[string]any) (*ToolResult, error)
}

// ToolResult 与 service.ToolResult 兼容。
type ToolResult struct {
	OK      bool   `json:"ok"`
	Data    any    `json:"data,omitempty"`
	Error   string `json:"error,omitempty"`
}

// principalKey 是 context.Context 中传递 Principal 的 key。
type principalKey struct{}

// WithPrincipal 把 Principal 存入 context，供工具适配器使用。
func WithPrincipal(ctx context.Context, p Principal) context.Context {
	return context.WithValue(ctx, principalKey{}, p)
}

// GetPrincipal 从 context 取出 Principal。
func GetPrincipal(ctx context.Context) Principal {
	if p, ok := ctx.Value(principalKey{}).(Principal); ok {
		return p
	}
	return Principal{Source: "eino"}
}

// toolAdapter 把 ideaevo 的 ToolExecutor 适配为 Eino 的 tool.InvokableTool。
type toolAdapter struct {
	impl ToolExecutor
}

// NewEinoTool 包装一个 ideaevo ToolExecutor 为 Eino InvokableTool。
func NewEinoTool(t ToolExecutor) tool.InvokableTool {
	return &toolAdapter{impl: t}
}

func (a *toolAdapter) Info(ctx context.Context) (*einoschema.ToolInfo, error) {
	return &einoschema.ToolInfo{
		Name: a.impl.Name(),
		Desc: a.impl.Description(),
		// ParamsOneOf: 现有 tool.Parameters() 返回 JSON Schema 字节，
		// 但 Eino 的 jsonschema.Schema 用了 orderedmap，无法直接 Unmarshal。
		// 传 nil 时 LLM 仍可自由生成参数（InvokableRun 接收 JSON 字符串）。
		// 工具描述里已包含参数说明，实践中 LLM 能正确调用。
		ParamsOneOf: nil,
	}, nil
}

func (a *toolAdapter) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...tool.Option) (string, error) {
	p := GetPrincipal(ctx)

	var input map[string]any
	if argumentsInJSON != "" {
		if err := json.Unmarshal([]byte(argumentsInJSON), &input); err != nil {
			return "", fmt.Errorf("parse tool arguments: %w", err)
		}
	}
	if input == nil {
		input = map[string]any{}
	}

	result, err := a.impl.Execute(ctx, p, input)
	if err != nil {
		return fmt.Sprintf(`{"ok":false,"error":%q}`, err.Error()), nil
	}

	data, err := json.Marshal(result)
	if err != nil {
		return `{"ok":false,"error":"marshal result failed"}`, nil
	}
	return string(data), nil
}

// WrapToolsForEino 把一组 ideaevo ToolExecutor 包装为 Eino BaseTool 列表。
func WrapToolsForEino(tools []ToolExecutor) []tool.BaseTool {
	result := make([]tool.BaseTool, 0, len(tools))
	for _, t := range tools {
		result = append(result, NewEinoTool(t))
	}
	return result
}
