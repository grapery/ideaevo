// Command reindex-ideas 将 MySQL 中所有 active idea 重新写入向量库（迁移/对账用）。
//
// 用法（仓库根目录）：
//
//	make reindex-ideas
//	# 或
//	cd backend && go run ./cmd/reindex-ideas
package main

import (
	"context"
	"log"
	"time"

	"github.com/wanye/ideaevo/internal/config"
	"github.com/wanye/ideaevo/internal/database"
	"github.com/wanye/ideaevo/internal/service"
	"github.com/wanye/ideaevo/pkg/dashvector"
)

func main() {
	cfg := config.Load()
	db := database.Connect(cfg)

	embedSvc := service.NewEmbeddingService(cfg.DashScopeAPIKey, "", cfg.EmbeddingModel, cfg.EmbeddingDimensions)
	vectorStore, backendName, err := service.NewVectorBackend(cfg)
	if err != nil {
		log.Fatalf("vector backend: %v", err)
	}
	if !embedSvc.Enabled() {
		log.Fatal("DASHSCOPE_API_KEY not set")
	}
	if vectorStore == nil || !vectorStore.Enabled() {
		log.Fatalf("vector backend %s not enabled", backendName)
	}

	if dvStore, ok := vectorStore.(*service.DashVectorStore); ok {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		if err := service.EnsureIdeasCollection(ctx, dvStore, cfg.VectorIndexIdeas, cfg.EmbeddingDimensions, dashvector.Metric(cfg.DashVectorMetric)); err != nil {
			log.Fatalf("ensure collection: %v", err)
		}
		cancel()
	}

	indexer := service.NewIdeaVectorIndexer(db, embedSvc, vectorStore, cfg.VectorIndexIdeas)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Minute)
	defer cancel()

	n, err := service.ReconcileAllActiveIdeas(ctx, db, indexer)
	if err != nil {
		log.Fatalf("reconcile failed: %v", err)
	}
	log.Printf("reindex complete: %d active ideas queued", n)
	log.Println("note: vector writes are async; wait a few minutes before searching")
}
