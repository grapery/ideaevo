package service

import (
	"testing"

	"github.com/wanye/ideaevo/internal/model"
)

func TestParseAssistantResponse_MarkdownDefault(t *testing.T) {
	raw := "### Hello\n\n**bold**"
	ct, content := ParseAssistantResponse(raw)
	if ct != model.MessageContentMarkdown {
		t.Fatalf("got %q", ct)
	}
	if content != raw {
		t.Fatalf("content changed: %q", content)
	}
}

func TestParseAssistantResponse_JSONEnvelope(t *testing.T) {
	raw := `{"content_type":"json","content":"{\"a\":1}"}`
	ct, content := ParseAssistantResponse(raw)
	if ct != model.MessageContentJSON {
		t.Fatalf("got %q", ct)
	}
	if content != `{"a":1}` {
		t.Fatalf("got %q", content)
	}
}

func TestParseAssistantResponse_TypePrefix(t *testing.T) {
	raw := "[type:text]\nplain line"
	ct, content := ParseAssistantResponse(raw)
	if ct != model.MessageContentText {
		t.Fatalf("got %q", ct)
	}
	if content != "plain line" {
		t.Fatalf("got %q", content)
	}
}
