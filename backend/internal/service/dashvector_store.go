package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/wanye/ideaevo/internal/config"
	"github.com/wanye/ideaevo/pkg/dashvector"
)

// DashVectorStoreConfig 是 DashVector 连接配置。
type DashVectorStoreConfig struct {
	Endpoint string
	APIKey   string
	Metric   dashvector.Metric
}

// DashVectorStore 封装百炼 DashVector 的 upsert / query / delete。
type DashVectorStore struct {
	client *dashvector.Client
	metric dashvector.Metric
}

// NewDashVectorStore 创建 DashVector 后端。Endpoint 与 APIKey 必填。
func NewDashVectorStore(cfg DashVectorStoreConfig) (*DashVectorStore, error) {
	if strings.TrimSpace(cfg.Endpoint) == "" {
		return nil, errors.New("vector store disabled: DASHVECTOR_ENDPOINT not set")
	}
	if strings.TrimSpace(cfg.APIKey) == "" {
		return nil, errors.New("vector store disabled: DASHSCOPE_API_KEY not set")
	}
	metric := cfg.Metric
	if metric == "" {
		metric = dashvector.MetricCosine
	}

	client, err := dashvector.NewClient(dashvector.Config{
		Endpoint: cfg.Endpoint,
		APIKey:   cfg.APIKey,
	})
	if err != nil {
		return nil, fmt.Errorf("dashvector client: %w", err)
	}
	return &DashVectorStore{client: client, metric: metric}, nil
}

func (s *DashVectorStore) Enabled() bool {
	return s != nil && s.client != nil
}

func (s *DashVectorStore) PutVector(ctx context.Context, collection, key string, vector []float32, metadata map[string]any) error {
	if !s.Enabled() {
		return errors.New("dashvector store disabled")
	}
	fields := withDefaults(metadata, map[string]any{
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
	_, err := s.client.UpsertDocs(ctx, collection, dashvector.UpsertDocsRequest{
		Docs: []dashvector.Doc{{
			ID:     key,
			Vector: vector,
			Fields: fields,
		}},
	})
	if err != nil {
		return fmt.Errorf("UpsertDocs(%s/%s) failed: %w", collection, key, err)
	}
	return nil
}

func (s *DashVectorStore) QueryByVector(ctx context.Context, collection string, query []float32, topK int, filter map[string]any) ([]VectorRecord, error) {
	if !s.Enabled() {
		return nil, errors.New("dashvector store disabled")
	}
	if topK <= 0 {
		topK = 10
	}

	req := dashvector.QueryRequest{
		Vector: query,
		TopK:   topK,
	}
	if filterExpr := DashVectorFilterExpr(filter); filterExpr != "" {
		req.Filter = filterExpr
	}

	resp, err := s.client.Query(ctx, collection, req)
	if err != nil {
		return nil, fmt.Errorf("Query(%s) failed: %w", collection, err)
	}

	records := make([]VectorRecord, 0, len(resp.Output))
	for _, doc := range resp.Output {
		rec := VectorRecord{
			Key:      doc.ID,
			Distance: dashvector.ScoreToDistance(doc.Score, s.metric),
			Meta:     doc.Fields,
		}
		if rec.Meta == nil {
			rec.Meta = map[string]any{}
		}
		records = append(records, rec)
	}
	return records, nil
}

func (s *DashVectorStore) DeleteVectors(ctx context.Context, collection string, keys []string) error {
	if !s.Enabled() {
		return errors.New("dashvector store disabled")
	}
	if len(keys) == 0 {
		return nil
	}
	const batchSize = 1000
	for i := 0; i < len(keys); i += batchSize {
		end := i + batchSize
		if end > len(keys) {
			end = len(keys)
		}
		if _, err := s.client.DeleteDocs(ctx, collection, dashvector.DeleteDocsRequest{IDs: keys[i:end]}); err != nil {
			return fmt.Errorf("DeleteDocs(%s, %d keys) failed: %w", collection, end-i, err)
		}
	}
	return nil
}

func (s *DashVectorStore) AsyncPut(collection, key string, vector []float32, metadata map[string]any) {
	if !s.Enabled() {
		return
	}
	col, k, vec, meta := collection, key, vector, metadata
	store := s
	asyncPutWithRetry(fmt.Sprintf("dashvector put %s/%s", col, k), func(ctx context.Context) error {
		return store.PutVector(ctx, col, k, vec, meta)
	})
}

func (s *DashVectorStore) AsyncDelete(collection string, keys []string) {
	if !s.Enabled() {
		return
	}
	col, k := collection, keys
	store := s
	asyncDeleteWithRetry(fmt.Sprintf("dashvector delete %s/%v", col, k), func(ctx context.Context) error {
		return store.DeleteVectors(ctx, col, k)
	})
}

// EnsureIdeasCollection 在 DashVector 上创建 ideas collection（已存在则忽略）。
func EnsureIdeasCollection(ctx context.Context, store *DashVectorStore, name string, dimension int, metric dashvector.Metric) error {
	if store == nil || !store.Enabled() {
		return nil
	}
	if metric == "" {
		metric = dashvector.MetricCosine
	}
	fields := map[string]dashvector.FieldType{
		"title":         dashvector.FieldString,
		"category":      dashvector.FieldString,
		"agent_id":      dashvector.FieldString,
		"owner_user_id": dashvector.FieldString,
		"status":        dashvector.FieldString,
		"tags":          dashvector.FieldString,
		"created_at":    dashvector.FieldString,
		"updated_at":    dashvector.FieldString,
	}
	req := dashvector.NewSingleVectorCollectionRequest(name, dimension, metric, fields)
	_, err := store.client.CreateCollection(ctx, req)
	if err != nil {
		if apiErr, ok := err.(*dashvector.APIError); ok {
			msg := strings.ToLower(apiErr.Message)
			if strings.Contains(msg, "exist") || strings.Contains(msg, "already") {
				return nil
			}
		}
		return err
	}
	return nil
}

// NewVectorBackend 按配置创建向量后端。VECTOR_BACKEND=dashvector|oss；未指定时：
//   - 配置了 DASHVECTOR_ENDPOINT → dashvector
//   - 否则若 OSS 向量 Bucket 齐全 → oss
func NewVectorBackend(cfg *config.Config) (VectorBackend, string, error) {
	backend := strings.ToLower(strings.TrimSpace(cfg.VectorBackend))
	switch backend {
	case "dashvector", "dv":
		store, err := NewDashVectorStore(DashVectorStoreConfig{
			Endpoint: cfg.DashVectorEndpoint,
			APIKey:   cfg.DashScopeAPIKey,
			Metric:   dashvector.Metric(cfg.DashVectorMetric),
		})
		if err != nil {
			return nil, "", err
		}
		return store, "dashvector", nil
	case "oss":
		store, err := NewVectorStore(VectorStoreConfig{
			AccessKeyID:     cfg.AliyunAccessKeyID,
			AccessKeySecret: cfg.AliyunAccessKeySecret,
			Bucket:          cfg.AliyunVectorBucket,
			Region:          cfg.AliyunVectorRegion,
			AccountID:       cfg.AliyunVectorAccountID,
		})
		if err != nil {
			return nil, "", err
		}
		return store, "oss", nil
	case "":
		if strings.TrimSpace(cfg.DashVectorEndpoint) != "" {
			store, err := NewDashVectorStore(DashVectorStoreConfig{
				Endpoint: cfg.DashVectorEndpoint,
				APIKey:   cfg.DashScopeAPIKey,
				Metric:   dashvector.Metric(cfg.DashVectorMetric),
			})
			if err != nil {
				return nil, "", err
			}
			return store, "dashvector", nil
		}
		store, err := NewVectorStore(VectorStoreConfig{
			AccessKeyID:     cfg.AliyunAccessKeyID,
			AccessKeySecret: cfg.AliyunAccessKeySecret,
			Bucket:          cfg.AliyunVectorBucket,
			Region:          cfg.AliyunVectorRegion,
			AccountID:       cfg.AliyunVectorAccountID,
		})
		if err != nil {
			return nil, "", err
		}
		return store, "oss", nil
	default:
		return nil, "", fmt.Errorf("unknown VECTOR_BACKEND %q (use dashvector or oss)", backend)
	}
}
