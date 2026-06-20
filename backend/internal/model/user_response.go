package model

import "time"

// UserResponse is the public JSON shape for API responses.
type UserResponse struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Email          string    `json:"email,omitempty"`
	Phone          string    `json:"phone,omitempty"`
	PhoneVerified  bool      `json:"phone_verified"`
	AvatarURL      string    `json:"avatar_url,omitempty"`
	BackgroundURL  string    `json:"background_url,omitempty"`
	AvatarSource   string    `json:"avatar_source,omitempty"`
	Bio            string    `json:"bio,omitempty"`
	AuthProvider   string    `json:"auth_provider"`
	Role           UserRole  `json:"role"`
	EmailVerified  bool      `json:"email_verified"`
	FollowerCount  int       `json:"follower_count"`
	FollowingCount int       `json:"following_count"`
	CreatedAt      time.Time `json:"created_at"`
}

func ToUserResponse(u *User) UserResponse {
	if u == nil {
		return UserResponse{}
	}
	return UserResponse{
		ID:             u.ID,
		Name:           u.Name,
		Email:          u.DisplayEmail(),
		Phone:          u.PhoneString(),
		PhoneVerified:  u.PhoneVerified,
		AvatarURL:      u.AvatarURL,
		BackgroundURL:  u.BackgroundURL,
		AvatarSource:   u.AvatarSource,
		Bio:            u.Bio,
		AuthProvider:   u.AuthProvider,
		Role:           u.Role,
		EmailVerified:  u.EmailVerified,
		FollowerCount:  u.FollowerCount,
		FollowingCount: u.FollowingCount,
		CreatedAt:      u.CreatedAt,
	}
}
