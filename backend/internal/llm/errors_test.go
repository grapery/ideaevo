package llm

import (
	"errors"
	"testing"
)

func TestParseHTTPError_MissingModel(t *testing.T) {
	body := []byte(`{"error":{"code":"MissingParameter","message":"missing model","type":"Bad Request","param":"model"}}`)
	err := ParseHTTPError("ark", "", "https://ark.cn-beijing.volces.com/api/v3", 400, body)
	if err.Code != "MissingParameter" {
		t.Fatalf("code = %q", err.Code)
	}
	if err.Hint == "" {
		t.Fatal("expected hint for missing model")
	}
}

func TestErrMissingModel(t *testing.T) {
	err := ErrMissingModel("ark", "https://ark.cn-beijing.volces.com/api/v3")
	var llmErr *Error
	if !errors.As(err, &llmErr) {
		t.Fatal("expected *llm.Error")
	}
	if llmErr.UserMessage() == "" {
		t.Fatal("expected user message")
	}
}

func TestErrorString(t *testing.T) {
	e := &Error{
		Provider:   "ark",
		Model:      "ep-test",
		StatusCode: 400,
		Code:       "MissingParameter",
		Message:    "missing model",
		RequestID:  "req-1",
		Hint:       "set HUOSHAN_TEXT_MODEL",
	}
	s := e.Error()
	if s == "" {
		t.Fatal("empty error string")
	}
}
