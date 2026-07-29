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
	// 会员状态（计费模块）。过期时 IsPro=false，但保留历史订阅信息。
	PlanTier      PlanTier  `json:"plan_tier"`
	IsPro         bool      `json:"is_pro"`          // 是否当前有效的付费会员
	PlanExpiresAt *time.Time `json:"plan_expires_at,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
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
		PlanTier:       u.PlanTier,
		IsPro:          isEffectivePro(u),
		PlanExpiresAt:  u.PlanExpiresAt,
		CreatedAt:      u.CreatedAt,
	}
}

// isEffectivePro 判断用户当前是否为有效付费会员（过期视为非 pro）。
// admin 永远视为 pro。
func isEffectivePro(u *User) bool {
	if u.Role == RoleAdmin {
		return true
	}
	if u.PlanTier != PlanPro {
		return false
	}
	if u.PlanExpiresAt == nil || u.PlanExpiresAt.Before(time.Now()) {
		return false
	}
	return true
}
