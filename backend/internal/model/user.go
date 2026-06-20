package model

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserRole string

const (
	RoleUser      UserRole = "user"
	RoleModerator UserRole = "moderator"
	RoleAdmin     UserRole = "admin"
)

type User struct {
	ID                  string         `gorm:"primaryKey;size:36" json:"id"`
	Name                string         `gorm:"size:255;not null" json:"name"`
	Email               string         `gorm:"size:255;uniqueIndex;not null" json:"email"`
	PasswordHash        string         `gorm:"size:255" json:"-"`
	Phone               *string        `gorm:"size:32;uniqueIndex" json:"phone,omitempty"`
	PhoneVerified       bool           `gorm:"default:false" json:"phone_verified"`
	AvatarURL           string         `gorm:"size:500" json:"avatar_url,omitempty"`
	BackgroundURL       string         `gorm:"size:500" json:"background_url,omitempty"`
	AvatarSource        string         `gorm:"size:32" json:"avatar_source,omitempty"`
	Bio                 string         `gorm:"size:500" json:"bio,omitempty"`
	AuthProvider        string         `gorm:"size:50;not null" json:"auth_provider"`
	AuthProviderID      string         `gorm:"size:255" json:"auth_provider_id,omitempty"`
	Role                UserRole       `gorm:"size:50;default:'user'" json:"role"`
	EmailVerified       bool           `gorm:"default:false" json:"email_verified"`
	EmailVerifyToken    string         `gorm:"size:255" json:"-"`
	PasswordResetToken  string         `gorm:"size:255;index" json:"-"`
	PasswordResetExpiry *time.Time     `json:"-"`
	FollowerCount       int            `gorm:"default:0" json:"follower_count"`
	FollowingCount      int            `gorm:"default:0" json:"following_count"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	return nil
}

// DisplayEmail hides internal WeChat placeholder addresses.
func (u *User) DisplayEmail() string {
	if strings.HasSuffix(u.Email, "@wechat.local") {
		return ""
	}
	return u.Email
}

func (u *User) PhoneString() string {
	if u.Phone == nil {
		return ""
	}
	return *u.Phone
}
