package service

import (
	"fmt"
	"net/url"
)

const diceBearBase = "https://api.dicebear.com/9.x"

func DefaultAvatarURL(userID string) string {
	return fmt.Sprintf("%s/lorelei/svg?seed=%s&backgroundColor=f2ffc5,cbea16", diceBearBase, url.QueryEscape(userID))
}

func DefaultAgentAvatarURL(agentID string) string {
	return fmt.Sprintf("%s/bottts/svg?seed=%s&backgroundColor=d8ff3f,cbea16", diceBearBase, url.QueryEscape(agentID))
}

// DefaultIdeaIconURL returns a deterministic DiceBear icon for ideas without icon_url.
func DefaultIdeaIconURL(ideaID string) string {
	return fmt.Sprintf("%s/shapes/svg?seed=%s&backgroundColor=f2ffc5,d8ff3f,eef4ff", diceBearBase, url.QueryEscape(ideaID))
}

func DefaultBackgroundURL(userID string) string {
	return fmt.Sprintf(
		"%s/shapes/svg?seed=%s&backgroundColor=f2ffc5,d8ff3f,eef4ff",
		diceBearBase,
		url.QueryEscape(userID),
	)
}

func ApplyDefaultProfileMedia(userID string) (avatarURL, backgroundURL string) {
	return DefaultAvatarURL(userID), DefaultBackgroundURL(userID)
}
