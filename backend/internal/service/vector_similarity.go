package service

import (
	"context"
	"fmt"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// VectorSimilaritySearcher 用阿里云 OSS 向量 Bucket 实现语义相似度检索。
// 它满足 SimilaritySearcher 接口，可替代降级实现 [LikeSimilaritySearcher]。
//
// 注意：返回的 IdeaMatch.Similarity 范围与降级实现（[LikeSimilaritySearcher]）的 [0,1] 保持一致，
// 供相关想法分析与 RAG 复用（阈值约 0.3）。
// 转换公式：similarity = 1 - distance/2 （OSS 默认 cosine_distance ∈ [0,2]）。
type VectorSimilaritySearcher struct {
	embed     *EmbeddingService
	store     VectorBackend
	db        *gorm.DB
	indexName string
}

func NewVectorSimilaritySearcher(db *gorm.DB, embed *EmbeddingService, store VectorBackend, indexName string) *VectorSimilaritySearcher {
	return &VectorSimilaritySearcher{
		db:        db,
		embed:     embed,
		store:     store,
		indexName: indexName,
	}
}

// Enabled 表示该 searcher 是否可用（依赖 embedding + vector store 都配置好）。
func (s *VectorSimilaritySearcher) Enabled() bool {
	return s != nil && s.embed != nil && s.embed.Enabled() && s.store != nil && s.store.Enabled()
}

func (s *VectorSimilaritySearcher) Search(queryText string, threshold float64, limit int) ([]IdeaMatch, error) {
	if !s.Enabled() {
		return nil, fmt.Errorf("vector searcher disabled")
	}
	if limit <= 0 {
		limit = 10
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	qvec, err := s.embed.Embed(ctx, queryText)
	if err != nil {
		return nil, fmt.Errorf("embed query failed: %w", err)
	}

	// 多取一倍候选，再在 DB 层过滤阈值（OSS 不支持距离阈值过滤，只能用 topK）。
	candidates := limit * 3
	if candidates < 10 {
		candidates = 10
	}

	records, err := s.store.QueryByVector(ctx, s.indexName, qvec, candidates, nil)
	if err != nil {
		return nil, fmt.Errorf("vector query failed: %w", err)
	}

	matches := make([]IdeaMatch, 0, limit)
	for _, r := range records {
		// OSS 距离 → 相似度
		sim := distanceToSimilarity(float64(r.Distance))
		if sim < threshold {
			continue
		}

		// 反查 idea 详情
		var idea model.Idea
		if err := s.db.Preload("Agent").First(&idea, "id = ?", r.Key).Error; err != nil {
			// 向量库里可能有过期/已删除的 idea，跳过
			continue
		}

		matches = append(matches, IdeaMatch{Idea: idea, Similarity: sim})
		if len(matches) >= limit {
			break
		}
	}

	return matches, nil
}

// distanceToSimilarity 把 OSS cosine_distance 转为 [0,1] 相似度。
// cosine_distance = 1 - cosine_similarity，范围 [0,2]；
// similarity = 1 - distance/2，使完全相同→1，正交→0.5，相反→0。
// 这样和降级实现一样，0.7 仍代表"很像"。
func distanceToSimilarity(distance float64) float64 {
	sim := 1.0 - distance/2.0
	if sim < 0 {
		return 0
	}
	if sim > 1 {
		return 1
	}
	return sim
}
