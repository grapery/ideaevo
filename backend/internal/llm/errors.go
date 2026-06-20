package llm

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

// Error is a structured LLM failure with provider context and actionable hints.
type Error struct {
	Provider   string
	Model      string
	BaseURL    string
	StatusCode int
	Code       string
	Message    string
	RequestID  string
	Param      string
	Hint       string
	Raw        string
}

func (e *Error) Error() string {
	if e == nil {
		return "llm error"
	}
	var b strings.Builder
	fmt.Fprintf(&b, "provider=%s", emptyDash(e.Provider))
	if e.Model != "" {
		fmt.Fprintf(&b, " model=%s", e.Model)
	}
	if e.BaseURL != "" {
		fmt.Fprintf(&b, " base=%s", e.BaseURL)
	}
	if e.StatusCode > 0 {
		fmt.Fprintf(&b, " status=%d", e.StatusCode)
	}
	if e.Code != "" {
		fmt.Fprintf(&b, " code=%s", e.Code)
	}
	if e.Message != "" {
		fmt.Fprintf(&b, " message=%s", e.Message)
	}
	if e.RequestID != "" {
		fmt.Fprintf(&b, " request_id=%s", e.RequestID)
	}
	if e.Hint != "" {
		fmt.Fprintf(&b, " hint=%s", e.Hint)
	}
	if e.Raw != "" && e.Message == "" {
		fmt.Fprintf(&b, " raw=%s", truncate(e.Raw, 500))
	}
	return strings.TrimSpace(b.String())
}

// UserMessage returns a concise message suitable for chat UI.
func (e *Error) UserMessage() string {
	if e == nil {
		return "对话失败：LLM 调用异常"
	}
	if e.Message != "" {
		msg := e.Message
		if e.Code != "" {
			msg = fmt.Sprintf("[%s] %s", e.Code, msg)
		}
		if e.Hint != "" {
			return fmt.Sprintf("⚠️ %s — %s", msg, e.Hint)
		}
		return "⚠️ " + msg
	}
	return "⚠️ 对话失败：" + e.Error()
}

type apiErrorBody struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Type    string `json:"type"`
		Param   string `json:"param"`
	} `json:"error"`
}

// ParseHTTPError builds a structured error from an OpenAI-compatible HTTP response.
func ParseHTTPError(provider, model, baseURL string, statusCode int, body []byte) *Error {
	err := &Error{
		Provider:   provider,
		Model:      model,
		BaseURL:    baseURL,
		StatusCode: statusCode,
		Raw:        string(body),
	}
	var parsed apiErrorBody
	if json.Unmarshal(body, &parsed) == nil {
		err.Code = strings.TrimSpace(parsed.Error.Code)
		err.Message = strings.TrimSpace(parsed.Error.Message)
		err.Param = strings.TrimSpace(parsed.Error.Param)
	}
	if err.Message == "" {
		err.Message = truncate(string(body), 300)
	}
	err.Hint = hintFor(provider, err.Code, err.Param, model)
	return err
}

// WrapArkError converts volcengine arkruntime errors into structured LLM errors.
func WrapArkError(provider, model, baseURL string, err error) error {
	if err == nil {
		return nil
	}
	out := &Error{
		Provider: provider,
		Model:    model,
		BaseURL:  baseURL,
		Message:  err.Error(),
		Raw:      err.Error(),
	}

	var reqErr *arkmodel.RequestError
	if errors.As(err, &reqErr) {
		out.StatusCode = reqErr.HTTPStatusCode
		out.RequestID = reqErr.RequestId
		var apiErr *arkmodel.APIError
		if errors.As(reqErr.Err, &apiErr) {
			out.Code = apiErr.Code
			out.Message = apiErr.Message
			out.StatusCode = apiErr.HTTPStatusCode
			if apiErr.RequestId != "" {
				out.RequestID = apiErr.RequestId
			}
			if apiErr.Param != nil {
				out.Param = *apiErr.Param
			}
		}
	} else {
		var apiErr *arkmodel.APIError
		if errors.As(err, &apiErr) {
			out.Code = apiErr.Code
			out.Message = apiErr.Message
			out.StatusCode = apiErr.HTTPStatusCode
			out.RequestID = apiErr.RequestId
			if apiErr.Param != nil {
				out.Param = *apiErr.Param
			}
		}
	}
	out.Hint = hintFor(provider, out.Code, out.Param, model)
	return out
}

// ErrMissingModel is returned before any network call when model is unset.
func ErrMissingModel(provider, baseURL string) error {
	return &Error{
		Provider: provider,
		BaseURL:  baseURL,
		Code:     "MissingModel",
		Message:  "model parameter is empty",
		Hint:     hintFor(provider, "MissingParameter", "model", ""),
	}
}

func hintFor(provider, code, param, model string) string {
	code = strings.TrimSpace(code)
	param = strings.TrimSpace(param)
	switch {
	case provider == "ark" && (code == "MissingParameter" && (param == "model" || strings.Contains(strings.ToLower(param), "model")) || code == "MissingModel" || model == ""):
		return "火山方舟需配置推理接入点 ID：在 .env 设置 HUOSHAN_TEXT_MODEL 或 LLM_MODEL=ep-xxxxxxxx（方舟控制台 → 推理接入点）"
	case provider == "ark" && (code == "InvalidEndpointOrModel.NotFound" || strings.Contains(code, "NotFound")):
		return "模型/接入点不存在或无权限：确认 LLM_MODEL 为方舟 Endpoint ID（ep-xxx），且 API Key 有访问权限"
	case provider == "dashscope" && model == "":
		return "请设置 LLM_MODEL（如 qwen-plus）"
	case provider == "openai" && model == "":
		return "请设置 LLM_MODEL（如 gpt-4o）"
	default:
		return ""
	}
}

func emptyDash(s string) string {
	if s == "" {
		return "-"
	}
	return s
}

func truncate(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
