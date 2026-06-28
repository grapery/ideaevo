package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type IdeaStatus string

const (
	IdeaStatusActive      IdeaStatus = "active"
	IdeaStatusBuried      IdeaStatus = "buried"
	IdeaStatusArchived    IdeaStatus = "archived"
	IdeaStatusImplemented IdeaStatus = "implemented"
)

// ImplStatus 描述想法从构想到落地的实现进度（可选，与生命周期 status 独立）。
type ImplStatus string

const (
	ImplStatusConcept    ImplStatus = "concept"
	ImplStatusInProgress ImplStatus = "in_progress"
	ImplStatusImplemented ImplStatus = "implemented"
	ImplStatusPaused     ImplStatus = "paused"
)

type Idea struct {
	ID           string     `gorm:"primaryKey;size:36" json:"id"`
	AgentID      string     `gorm:"size:36;index;not null" json:"agent_id"`
	Agent        Agent      `gorm:"foreignKey:AgentID" json:"agent,omitempty"`
	Title        string     `gorm:"size:500;not null" json:"title"`
	Description  string     `gorm:"type:text;not null" json:"description"`
	Status       IdeaStatus `gorm:"size:50;default:'active';index" json:"status"`
	Category     string     `gorm:"size:100;index" json:"category"`
	Tags         string     `gorm:"type:json" json:"tags"`
	RepoURL      string     `gorm:"size:500" json:"repo_url,omitempty"`
	DemoURL      string     `gorm:"size:500" json:"demo_url,omitempty"`
	IconURL      string     `gorm:"size:500" json:"icon_url,omitempty"`
	ImplStatus   ImplStatus `gorm:"size:30" json:"impl_status,omitempty"`
	ForkedFromID *string    `gorm:"size:36;index" json:"forked_from_id,omitempty"`
	DedupHash    string     `gorm:"size:64;index" json:"dedup_hash"`
	LikeCount    int        `gorm:"default:0" json:"like_count"`
	FlowerCount  int        `gorm:"default:0" json:"flower_count"`
	ForkCount    int        `gorm:"default:0" json:"fork_count"`
	CommentCount int        `gorm:"default:0" json:"comment_count"`
	CreatedAt    time.Time  `gorm:"index" json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	BuriedAt     *time.Time `json:"buried_at,omitempty"`
	BuriedReason string     `json:"buried_reason,omitempty"`
	Versions     []IdeaVersion `gorm:"foreignKey:IdeaID" json:"versions,omitempty"`
}

func (i *Idea) BeforeCreate(tx *gorm.DB) error {
	if i.ID == "" {
		i.ID = uuid.New().String()
	}
	// MySQL 不允许 JSON 列设默认值，这里兜底
	if i.Tags == "" {
		i.Tags = "[]"
	}
	return nil
}

type IdeaVersion struct {
	ID          string    `gorm:"primaryKey;size:36" json:"id"`
	IdeaID      string    `gorm:"size:36;index;not null" json:"idea_id"`
	Version     int       `gorm:"not null" json:"version"`
	Title       string    `gorm:"size:500;not null" json:"title"`
	Description string    `gorm:"type:text;not null" json:"description"`
	Changelog   string    `gorm:"type:text" json:"changelog"`
	CreatedAt   time.Time `json:"created_at"`
}

func (v *IdeaVersion) BeforeCreate(tx *gorm.DB) error {
	if v.ID == "" {
		v.ID = uuid.New().String()
	}
	return nil
}
