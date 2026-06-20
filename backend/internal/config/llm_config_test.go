package config

import (
	"os"
	"testing"
)

func TestResolveLLMConfig_ArkBeforeDashScope(t *testing.T) {
	t.Setenv("LLM_API_KEY", "")
	t.Setenv("ARK_API_KEY", "ark-key")
	t.Setenv("DASHSCOPE_API_KEY", "dash-key")
	t.Setenv("LLM_MODEL", "ep-test-endpoint")

	cfg := ResolveLLMConfig()
	if cfg.Provider != "ark" {
		t.Fatalf("provider = %q, want ark", cfg.Provider)
	}
	if cfg.Model != "ep-test-endpoint" {
		t.Fatalf("model = %q, want ep-test-endpoint", cfg.Model)
	}
	if cfg.APIKey != "ark-key" {
		t.Fatalf("api key = %q, want ark-key", cfg.APIKey)
	}
}

func TestResolveLLMConfig_ArkHuoshanTextModel(t *testing.T) {
	t.Setenv("LLM_API_KEY", "")
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("HUOSHAN_API_KEY", "hs-key")
	t.Setenv("LLM_MODEL", "")
	t.Setenv("ARK_MODEL", "")
	t.Setenv("HUOSHAN_MODEL", "")
	t.Setenv("HUOSHAN_TEXT_MODEL", "ep-from-text-model")

	cfg := ResolveLLMConfig()
	if cfg.Provider != "ark" {
		t.Fatalf("provider = %q, want ark", cfg.Provider)
	}
	if cfg.Model != "ep-from-text-model" {
		t.Fatalf("model = %q, want ep-from-text-model", cfg.Model)
	}
}

func TestResolveLLMConfig_ArkDefaultModel(t *testing.T) {
	t.Setenv("LLM_API_KEY", "")
	t.Setenv("HUOSHAN_API_KEY", "hs-key")
	t.Setenv("LLM_MODEL", "")
	t.Setenv("HUOSHAN_TEXT_MODEL", "")

	cfg := ResolveLLMConfig()
	if cfg.Model != DefaultArkTextModel {
		t.Fatalf("model = %q, want default %s", cfg.Model, DefaultArkTextModel)
	}
}

func TestResolveLLMConfig_DashScopeOnly(t *testing.T) {
	os.Unsetenv("LLM_API_KEY")
	os.Unsetenv("ARK_API_KEY")
	os.Unsetenv("HUOSHAN_API_KEY")
	t.Setenv("DASHSCOPE_API_KEY", "dash-key")

	cfg := ResolveLLMConfig()
	if cfg.Provider != "dashscope" {
		t.Fatalf("provider = %q, want dashscope", cfg.Provider)
	}
	if cfg.Model != "qwen-plus" {
		t.Fatalf("model = %q, want qwen-plus", cfg.Model)
	}
}
