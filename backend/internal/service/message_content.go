package service

import (
	"encoding/json"
	"strings"

	"github.com/wanye/ideaevo/internal/model"
)

type assistantPayload struct {
	ContentType string `json:"content_type"`
	Content     string `json:"content"`
}

const responseFormatInstructions = `

## 回复格式（前端渲染）
默认直接使用 Markdown 书写回复（标题、列表、加粗等），系统按 markdown 渲染。

仅在特殊情况用首行标记类型（标记行不会展示给用户）：
- [type:text] — 下一行起为纯文本，不做格式化
- [type:json] — 下一行起为合法 JSON（对象或数组），前端会格式化展示

未加标记时一律按 Markdown 渲染。`

// ParseAssistantResponse extracts content_type and body from LLM output.
// Falls back to markdown when the model returns plain Markdown text (streaming).
func ParseAssistantResponse(raw string) (contentType, content string) {
	contentType = model.MessageContentMarkdown
	content = strings.TrimSpace(raw)
	if content == "" {
		return contentType, content
	}

	// Full JSON envelope: {"content_type":"markdown","content":"..."}
	if strings.HasPrefix(content, "{") {
		var payload assistantPayload
		if err := json.Unmarshal([]byte(content), &payload); err == nil && payload.Content != "" {
			if ct := normalizeContentType(payload.ContentType); ct != "" {
				return ct, payload.Content
			}
			return model.MessageContentMarkdown, payload.Content
		}
	}

	// Line prefix for streaming-friendly hints: [type:json] or [type:text]
	if strings.HasPrefix(content, "[type:") {
		if rest, ok := strings.CutPrefix(content, "[type:"); ok {
			if typ, body, found := strings.Cut(rest, "]"); found {
				body = strings.TrimLeft(body, "\n")
				if ct := normalizeContentType(typ); ct != "" && body != "" {
					return ct, body
				}
			}
		}
	}

	return contentType, content
}

func normalizeContentType(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case model.MessageContentMarkdown, "md":
		return model.MessageContentMarkdown
	case model.MessageContentText, "plain", "plaintext":
		return model.MessageContentText
	case model.MessageContentJSON:
		return model.MessageContentJSON
	default:
		return ""
	}
}
