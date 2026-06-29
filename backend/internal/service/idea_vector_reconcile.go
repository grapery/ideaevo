package service

import (
	"context"
	"fmt"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// ReconcileAllActiveIdeas 将 MySQL 中所有 active idea 重新写入向量库（用于迁移/对账）。
func ReconcileAllActiveIdeas(ctx context.Context, db *gorm.DB, indexer *IdeaVectorIndexer) (int, error) {
	if indexer == nil || !indexer.Enabled() {
		return 0, fmt.Errorf("vector indexer disabled")
	}
	if db == nil {
		return 0, fmt.Errorf("db is nil")
	}

	var ideas []model.Idea
	if err := db.Where("status = ?", model.IdeaStatusActive).Find(&ideas).Error; err != nil {
		return 0, fmt.Errorf("list active ideas: %w", err)
	}

	count := 0
	for i := range ideas {
		select {
		case <-ctx.Done():
			return count, ctx.Err()
		default:
		}
		indexer.IndexIdea(&ideas[i])
		count++
		// 限速，避免 embedding API 突发
		if i > 0 && i%20 == 0 {
			time.Sleep(200 * time.Millisecond)
		}
	}
	return count, nil
}
