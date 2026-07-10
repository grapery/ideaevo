package service

import (
	"context"
	"fmt"
	"strings"

	"google.golang.org/api/idtoken"
)

func (s *AuthService) GoogleMobileEnabled() bool {
	return len(s.googleIDTokenAudiences()) > 0
}

func (s *AuthService) googleIDTokenAudiences() []string {
	seen := map[string]struct{}{}
	var out []string
	for _, aud := range []string{s.googleIOSClientID, s.webGoogleClientID()} {
		aud = strings.TrimSpace(aud)
		if aud == "" {
			continue
		}
		if _, ok := seen[aud]; ok {
			continue
		}
		seen[aud] = struct{}{}
		out = append(out, aud)
	}
	return out
}

func (s *AuthService) webGoogleClientID() string {
	if s.oauthConfig == nil {
		return ""
	}
	return s.oauthConfig.ClientID
}

func (s *AuthService) VerifyGoogleIDToken(tokenStr string) (*GoogleUserInfo, error) {
	audiences := s.googleIDTokenAudiences()
	if len(audiences) == 0 {
		return nil, fmt.Errorf("google oauth not configured")
	}

	var lastErr error
	for _, audience := range audiences {
		payload, err := idtoken.Validate(context.Background(), tokenStr, audience)
		if err != nil {
			lastErr = err
			continue
		}

		info := &GoogleUserInfo{
			ID: payload.Subject,
		}
		if email, ok := payload.Claims["email"].(string); ok {
			info.Email = email
		}
		if name, ok := payload.Claims["name"].(string); ok {
			info.Name = name
		}
		if picture, ok := payload.Claims["picture"].(string); ok {
			info.Picture = picture
		}
		return info, nil
	}
	if lastErr != nil {
		return nil, fmt.Errorf("google id token invalid: %w", lastErr)
	}
	return nil, fmt.Errorf("google id token invalid")
}
