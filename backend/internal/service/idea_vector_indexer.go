package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// IdeaVectorIndexer 负责 idea 与向量后端（DashVector / OSS）之间的双向同步。
//
// 使用模式：
//   - idea 注册/更新时 → IndexIdea(idea) 异步写入向量（仅 status=active）
//   - idea bury/delete 时 → RemoveIdea(ideaID) 异步删除向量
//
// 所有操作都容忍向量服务不可用（降级为 no-op + 日志），
// 因此主流程不会因向量故障失败。
type IdeaVectorIndexer struct {
	db        *gorm.DB
	embed     *EmbeddingService
	store     VectorBackend
	indexName string
}

func NewIdeaVectorIndexer(db *gorm.DB, embed *EmbeddingService, store VectorBackend, indexName string) *IdeaVectorIndexer {
	return &IdeaVectorIndexer{
		db:        db,
		embed:     embed,
		store:     store,
		indexName: indexName,
	}
}

// Enabled 表示是否实际工作。关闭时所有方法都是 no-op。
func (i *IdeaVectorIndexer) Enabled() bool {
	return i != nil && i.embed != nil && i.embed.Enabled() && i.store != nil && i.store.Enabled()
}

// IndexIdea 异步索引（或更新）一条 idea。
// 仅 status=active 的 idea 会写入向量库；其他状态会触发删除。
func (i *IdeaVectorIndexer) IndexIdea(idea *model.Idea) {
	if !i.Enabled() || idea == nil {
		return
	}
	if idea.Status != model.IdeaStatusActive {
		i.RemoveIdea(idea.ID)
		return
	}

	ownerUserID, err := i.resolveOwnerUserID(idea)
	if err != nil {
		log.Printf("[vector] resolve owner for idea %s failed: %v", idea.ID, err)
		return
	}

	text := buildIdeaEmbeddingText(idea)
	now := time.Now().UTC().Format(time.RFC3339)
	metadata := map[string]any{
		"title":         idea.Title,
		"category":      idea.Category,
		"agent_id":      idea.AgentID,
		"owner_user_id": ownerUserID,
		"status":        string(idea.Status),
		"created_at":    idea.CreatedAt.UTC().Format(time.RFC3339),
		"updated_at":    now,
	}
	if idea.Tags != "" {
		metadata["tags"] = idea.Tags
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	vec, err := i.embed.Embed(ctx, text)
	if err != nil {
		log.Printf("[vector] embed idea %s failed: %v", idea.ID, err)
		return
	}

	ideaID := idea.ID
	indexName := i.indexName
	store := i.store
	asyncPutWithRetry(fmt.Sprintf("put %s/%s", indexName, ideaID), func(ctx context.Context) error {
		return store.PutVector(ctx, indexName, ideaID, vec, metadata)
	})
}

// RemoveIdea 异步从向量索引中删除一条 idea。
func (i *IdeaVectorIndexer) RemoveIdea(ideaID string) {
	if !i.Enabled() || ideaID == "" {
		return
	}
	indexName := i.indexName
	store := i.store
	keys := []string{ideaID}
	asyncDeleteWithRetry(fmt.Sprintf("delete %s/%s", indexName, ideaID), func(ctx context.Context) error {
		return store.DeleteVectors(ctx, indexName, keys)
	})
}

func (i *IdeaVectorIndexer) resolveOwnerUserID(idea *model.Idea) (string, error) {
	if idea.Agent.OwnerUserID != "" {
		return idea.Agent.OwnerUserID, nil
	}
	if i.db == nil {
		return "", fmt.Errorf("db not configured")
	}
	var agent model.Agent
	if err := i.db.Select("owner_user_id").First(&agent, "id = ?", idea.AgentID).Error; err != nil {
		return "", err
	}
	return agent.OwnerUserID, nil
}

// buildIdeaEmbeddingText 把 idea 的核心字段拼成 embedding 输入文本。
func buildIdeaEmbeddingText(idea *model.Idea) string {
	var parts []string
	if idea.Title != "" {
		parts = append(parts, idea.Title)
	}
	if idea.Category != "" {
		parts = append(parts, "分类："+idea.Category)
	}
	if idea.Description != "" {
		parts = append(parts, idea.Description)
	}
	if idea.Tags != "" {
		parts = append(parts, idea.Tags)
	}
	return strings.Join(parts, "\n")
}
