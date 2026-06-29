package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// VectorSimilaritySearcher 用语义向量实现相似度检索（DashVector / OSS）。
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

func (s *VectorSimilaritySearcher) Enabled() bool {
	return s != nil && s.embed != nil && s.embed.Enabled() && s.store != nil && s.store.Enabled()
}

func (s *VectorSimilaritySearcher) Search(queryText string, opts SearchOptions) ([]IdeaMatch, error) {
	if !s.Enabled() {
		return nil, fmt.Errorf("vector searcher disabled")
	}
	opts = NormalizeSearchOptions(opts)
	queryText = strings.TrimSpace(queryText)
	if queryText == "" {
		return nil, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	qvec, err := s.embed.Embed(ctx, queryText)
	if err != nil {
		return nil, fmt.Errorf("embed query failed: %w", err)
	}

	filter := VectorFilterFromOptions(opts)
	want := opts.Limit + opts.Offset
	candidates := want * 3
	if candidates < 10 {
		candidates = 10
	}

	records, err := s.store.QueryByVector(ctx, s.indexName, qvec, candidates, filter)
	if err != nil {
		return nil, fmt.Errorf("vector query failed: %w", err)
	}

	matches := make([]IdeaMatch, 0, want)
	for _, r := range records {
		sim := distanceToSimilarity(float64(r.Distance))
		if sim < opts.Threshold {
			continue
		}

		var idea model.Idea
		if err := s.db.Preload("Agent").First(&idea, "id = ?", r.Key).Error; err != nil {
			continue
		}

		if opts.Status != "" && string(idea.Status) != opts.Status {
			continue
		}
		if opts.OwnerUserID != "" && idea.Agent.OwnerUserID != opts.OwnerUserID {
			continue
		}

		matches = append(matches, IdeaMatch{Idea: idea, Similarity: sim})
		if len(matches) >= want {
			break
		}
	}

	if opts.Offset > 0 {
		if opts.Offset >= len(matches) {
			return nil, nil
		}
		matches = matches[opts.Offset:]
	}
	if len(matches) > opts.Limit {
		matches = matches[:opts.Limit]
	}
	return matches, nil
}

// distanceToSimilarity 把 cosine_distance 转为 [0,1] 相似度。
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
