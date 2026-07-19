package service

import (
	"strings"

	"github.com/wanye/ideaevo/internal/model"
)

// ResolveUserAvatar returns a display URL for user avatars (DiceBear 9.x when empty).
func ResolveUserAvatar(userID, raw string) string {
	if strings.TrimSpace(raw) != "" {
		return raw
	}
	return DefaultAvatarURL(userID)
}

// ResolveAgentAvatar returns a display URL for agent avatars.
func ResolveAgentAvatar(agentID, raw string) string {
	if strings.TrimSpace(raw) != "" {
		return raw
	}
	return DefaultAgentAvatarURL(agentID)
}

// ResolveIdeaIcon returns a display URL for idea icons.
func ResolveIdeaIcon(ideaID, raw string) string {
	if strings.TrimSpace(raw) != "" {
		return raw
	}
	return DefaultIdeaIconURL(ideaID)
}

// ResolveUserBackground fills empty profile backgrounds.
func ResolveUserBackground(userID, raw string) string {
	if strings.TrimSpace(raw) != "" {
		return raw
	}
	return DefaultBackgroundURL(userID)
}

// ResolveActorAvatar resolves activity/notification actor avatars.
func ResolveActorAvatar(actorType, actorID, raw string) string {
	switch actorType {
	case "agent":
		return ResolveAgentAvatar(actorID, raw)
	default:
		return ResolveUserAvatar(actorID, raw)
	}
}

func EnrichUser(u *model.User) {
	if u == nil {
		return
	}
	u.AvatarURL = ResolveUserAvatar(u.ID, u.AvatarURL)
	u.BackgroundURL = ResolveUserBackground(u.ID, u.BackgroundURL)
}

func EnrichUserResponse(u *model.User) model.UserResponse {
	if u == nil {
		return model.UserResponse{}
	}
	copy := *u
	EnrichUser(&copy)
	return model.ToUserResponse(&copy)
}

func EnrichAgent(a *model.Agent) {
	if a == nil {
		return
	}
	a.AvatarURL = ResolveAgentAvatar(a.ID, a.AvatarURL)
	// System assistant: built-in agent with no owning user (e.g. 万叶助手).
	if a.OwnerUserID == "" {
		a.IsSystemAssistant = true
	}
	// Personal agent: auto-created as a user's default workspace agent (EnsureDefaultUserAgent),
	// recognized by the "<用户名>的想法" naming convention. Used by clients to attribute an idea
	// to the real user rather than showing an AI badge.
	if a.OwnerUserID != "" && strings.HasSuffix(a.Name, "的想法") {
		a.IsPersonal = true
	}
}

func EnrichAgents(agents []model.Agent) {
	for i := range agents {
		EnrichAgent(&agents[i])
	}
}

func EnrichIdea(idea *model.Idea) {
	if idea == nil {
		return
	}
	idea.IconURL = ResolveIdeaIcon(idea.ID, idea.IconURL)
	EnrichAgent(&idea.Agent)
}

func EnrichIdeas(ideas []model.Idea) {
	for i := range ideas {
		EnrichIdea(&ideas[i])
	}
}
