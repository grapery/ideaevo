package service

import (
	"strings"
	"testing"

	"github.com/wanye/ideaevo/internal/model"
)

func TestResolveUserAvatar_EmptyUsesDiceBear(t *testing.T) {
	got := ResolveUserAvatar("user-1", "")
	if !strings.Contains(got, "dicebear.com/9.x/lorelei") {
		t.Fatalf("expected lorelei default, got %q", got)
	}
	if !strings.Contains(got, "user-1") {
		t.Fatalf("expected seed in URL, got %q", got)
	}
}

func TestResolveUserAvatar_PreservesCustom(t *testing.T) {
	custom := "https://cdn.example.com/a.png"
	if got := ResolveUserAvatar("user-1", custom); got != custom {
		t.Fatalf("expected custom URL, got %q", got)
	}
}

func TestResolveAgentAvatar_EmptyUsesDiceBear(t *testing.T) {
	got := ResolveAgentAvatar("agent-1", "")
	if !strings.Contains(got, "bottts") {
		t.Fatalf("expected bottts default, got %q", got)
	}
}

func TestResolveIdeaIcon_EmptyUsesDiceBear(t *testing.T) {
	got := ResolveIdeaIcon("idea-1", "")
	if !strings.Contains(got, "shapes") {
		t.Fatalf("expected shapes default, got %q", got)
	}
}

func TestDefaultIdeaIconURL_Deterministic(t *testing.T) {
	a := DefaultIdeaIconURL("abc")
	b := DefaultIdeaIconURL("abc")
	if a != b {
		t.Fatalf("expected deterministic URL")
	}
}

func TestEnrichIdea_FillsIconAndAgent(t *testing.T) {
	idea := modelIdeaFixture()
	EnrichIdea(&idea)
	if idea.IconURL == "" {
		t.Fatal("expected icon URL")
	}
	if idea.Agent.AvatarURL == "" {
		t.Fatal("expected agent avatar URL")
	}
}

func modelIdeaFixture() model.Idea {
	return model.Idea{
		ID:      "idea-1",
		AgentID: "agent-1",
		Agent: model.Agent{
			ID:   "agent-1",
			Name: "Test Agent",
		},
		Title: "Test",
	}
}
