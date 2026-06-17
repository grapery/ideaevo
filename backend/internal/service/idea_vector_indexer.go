package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/wanye/ideaevo/internal/model"
)

// IdeaVectorIndexer 负责 idea 与 OSS 向量 Bucket 之间的双向同步。
//
// 使用模式：
//   - idea 注册/更新时 → IndexIdea(idea) 异步写入向量
//   - idea bury/delete 时 → RemoveIdea(ideaID) 异步删除向量
//
// 所有操作都容忍向量服务不可用（降级为 no-op + 日志），
// 因此主流程不会因向量故障失败。
type IdeaVectorIndexer struct {
	embed     *EmbeddingService
	store     *VectorStore
	indexName string
}

func NewIdeaVectorIndexer(embed *EmbeddingService, store *VectorStore, indexName string) *IdeaVectorIndexer {
	return &IdeaVectorIndexer{
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
// 用于：idea.Register、idea.Update、idea.Fork。
func (i *IdeaVectorIndexer) IndexIdea(idea *model.Idea) {
	if !i.Enabled() || idea == nil {
		return
	}

	text := buildIdeaEmbeddingText(idea)
	metadata := map[string]any{
		"title":      idea.Title,
		"category":   idea.Category,
		"agent_id":   idea.AgentID,
		"status":     string(idea.Status),
		"created_at": idea.CreatedAt.UTC().Format(time.RFC3339),
	}
	if idea.Tags != "" {
		metadata["tags"] = idea.Tags
	}

	// 同步 embed（10-50ms），再异步写入 OSS（容忍 1-5s 延迟）
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	vec, err := i.embed.Embed(ctx, text)
	if err != nil {
		// embedding 失败不能阻塞 idea 创建主流程，只记录
		fmt.Printf("[vector] embed idea %s failed: %v\n", idea.ID, err)
		return
	}

	i.store.AsyncPut(i.indexName, idea.ID, vec, metadata)
}

// RemoveIdea 异步从向量索引中删除一条 idea。
// 用于：idea.Bury（status=buried 后让它不再出现在搜索结果）。
func (i *IdeaVectorIndexer) RemoveIdea(ideaID string) {
	if !i.Enabled() || ideaID == "" {
		return
	}
	i.store.AsyncDelete(i.indexName, []string{ideaID})
}

// buildIdeaEmbeddingText 把 idea 的核心字段拼成 embedding 输入文本。
// 顺序与权重：标题最重要，然后是分类、描述、tags。
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
