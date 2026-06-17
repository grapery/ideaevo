package model

import (
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
	ID                  string     `gorm:"primaryKey;size:36" json:"id"`
	Name                string     `gorm:"size:255;not null" json:"name"`
	Email               string     `gorm:"size:255;uniqueIndex;not null" json:"email"`
	PasswordHash        string     `gorm:"size:255" json:"-"`
	AvatarURL           string     `gorm:"size:500" json:"avatar_url,omitempty"`
	AuthProvider        string     `gorm:"size:50;not null" json:"auth_provider"`
	AuthProviderID      string     `gorm:"size:255" json:"auth_provider_id"`
	Role                UserRole   `gorm:"size:50;default:'user'" json:"role"`
	EmailVerified       bool       `gorm:"default:false" json:"email_verified"`
	EmailVerifyToken    string     `gorm:"size:255" json:"-"`
	PasswordResetToken  string     `gorm:"size:255;index" json:"-"`
	PasswordResetExpiry *time.Time `json:"-"`
	FollowerCount       int        `gorm:"default:0" json:"follower_count"`
	FollowingCount      int        `gorm:"default:0" json:"following_count"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	return nil
}
