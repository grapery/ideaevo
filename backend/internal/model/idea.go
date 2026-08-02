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
	ImplStatusConcept     ImplStatus = "concept"
	ImplStatusInProgress  ImplStatus = "in_progress"
	ImplStatusImplemented ImplStatus = "implemented"
	ImplStatusPaused      ImplStatus = "paused"
)

type Idea struct {
	ID           string        `gorm:"primaryKey;size:36" json:"id"`
	AgentID      string        `gorm:"size:36;index;not null" json:"agent_id"`
	Agent        Agent         `gorm:"foreignKey:AgentID" json:"agent,omitempty"`
	Title        string        `gorm:"size:500;not null" json:"title"`
	Description  string        `gorm:"type:text;not null" json:"description"`
	Status       IdeaStatus    `gorm:"size:50;default:'active';index" json:"status"`
	Category     string        `gorm:"size:100;index" json:"category"`
	Tags         string        `gorm:"type:json" json:"tags"`
	RepoURL      string        `gorm:"size:500" json:"repo_url,omitempty"`
	DemoURL      string        `gorm:"size:500" json:"demo_url,omitempty"`
	IconURL      string        `gorm:"size:500" json:"icon_url,omitempty"`
	ImplStatus   ImplStatus    `gorm:"size:30" json:"impl_status,omitempty"`
	// 多媒体展示(Product Hunt 式):封面图、宣传视频、截图画廊、通用链接列表。
	VideoURL   string   `gorm:"size:500" json:"video_url,omitempty"`
	CoverURL   string   `gorm:"size:500" json:"cover_url,omitempty"`
	ImageURLs  string   `gorm:"type:json" json:"image_urls,omitempty"`
	Links      string   `gorm:"type:json" json:"links,omitempty"`
	// 描述格式标识:默认 true 按 markdown 渲染,false 按纯文本渲染,保证 UI 渲染稳定。
	IsMarkdown bool     `gorm:"default:true" json:"is_markdown"`
	ForkedFromID *string       `gorm:"size:36;index" json:"forked_from_id,omitempty"`
	DedupHash    string        `gorm:"size:64;index" json:"dedup_hash"`
	LikeCount    int           `gorm:"default:0" json:"like_count"`
	FlowerCount  int           `gorm:"default:0" json:"flower_count"`
	ForkCount    int           `gorm:"default:0" json:"fork_count"`
	CommentCount int           `gorm:"default:0" json:"comment_count"`
	WishCount    int           `gorm:"default:0" json:"wish_count"`
	// 信誉加权的综合分:投票时按 actor 信誉分累加,用于榜单排序防刷。
	WeightedScore float64      `gorm:"default:0" json:"weighted_score"`
	CreatedAt    time.Time     `gorm:"index" json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
	BuriedAt     *time.Time    `json:"buried_at,omitempty"`
	BuriedReason string        `json:"buried_reason,omitempty"`
	ArchivedAt   *time.Time    `json:"archived_at,omitempty"`
	ArchivedReason string      `json:"archived_reason,omitempty"`
	ImplementedAt *time.Time   `json:"implemented_at,omitempty"`
	ImplementedReason string   `json:"implemented_reason,omitempty"`
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
	if i.ImageURLs == "" {
		i.ImageURLs = "[]"
	}
	if i.Links == "" {
		i.Links = "[]"
	}
	return nil
}

type IdeaVersion struct {
	ID          string     `gorm:"primaryKey;size:36" json:"id"`
	IdeaID      string     `gorm:"size:36;index;not null" json:"idea_id"`
	Version     int        `gorm:"not null" json:"version"`
	Title       string     `gorm:"size:500;not null" json:"title"`
	Description string     `gorm:"type:text;not null" json:"description"`
	Category    string     `gorm:"size:100" json:"category"`
	Tags        string     `gorm:"type:json" json:"tags"`
	RepoURL     string     `gorm:"size:500" json:"repo_url,omitempty"`
	DemoURL     string     `gorm:"size:500" json:"demo_url,omitempty"`
	ImplStatus  ImplStatus `gorm:"size:30" json:"impl_status,omitempty"`
	Changelog   string     `gorm:"type:text" json:"changelog"`
	CreatedAt   time.Time  `json:"created_at"`
}

func (v *IdeaVersion) BeforeCreate(tx *gorm.DB) error {
	if v.ID == "" {
		v.ID = uuid.New().String()
	}
	if v.Tags == "" {
		v.Tags = "[]"
	}
	return nil
}
