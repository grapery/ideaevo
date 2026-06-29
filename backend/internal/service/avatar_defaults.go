package service

import (
	"fmt"
	"net/url"
)

const diceBearBase = "https://api.dicebear.com/9.x"

func DefaultAvatarURL(userID string) string {
	return fmt.Sprintf("%s/lorelei/svg?seed=%s", diceBearBase, url.QueryEscape(userID))
}

func DefaultAgentAvatarURL(agentID string) string {
	return fmt.Sprintf("%s/bottts/svg?seed=%s", diceBearBase, url.QueryEscape(agentID))
}

func DefaultBackgroundURL(userID string) string {
	return fmt.Sprintf(
		"%s/shapes/svg?seed=%s&backgroundColor=e8efe9,6b8cae,d4a04a",
		diceBearBase,
		url.QueryEscape(userID),
	)
}

func ApplyDefaultProfileMedia(userID string) (avatarURL, backgroundURL string) {
	return DefaultAvatarURL(userID), DefaultBackgroundURL(userID)
}
