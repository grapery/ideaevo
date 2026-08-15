package service

import (
	"context"
)

// VectorBackend 抽象 idea 向量索引的读写，支持 OSS 向量 Bucket 与 DashVector。
type VectorBackend interface {
	Enabled() bool
	PutVector(ctx context.Context, collection, key string, vector []float32, metadata map[string]any) error
	QueryByVector(ctx context.Context, collection string, query []float32, topK int, filter map[string]any) ([]VectorRecord, error)
	DeleteVectors(ctx context.Context, collection string, keys []string) error
	AsyncPut(collection, key string, vector []float32, metadata map[string]any)
	AsyncDelete(collection string, keys []string)
}

// 编译期断言两种实现均满足 VectorBackend。
var (
	_ VectorBackend = (*VectorStore)(nil)
	_ VectorBackend = (*DashVectorStore)(nil)
)
