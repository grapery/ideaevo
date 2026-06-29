package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss"
	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss/credentials"
	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss/vectors"
)

// VectorStoreConfig 是 OSS 向量 Bucket 的连接配置。
type VectorStoreConfig struct {
	AccessKeyID     string
	AccessKeySecret string
	Bucket          string
	Region          string // e.g., "cn-shanghai"
	AccountID       string // 阿里云主账号 ID（签名必需）
}

// VectorRecord 是检索返回的单条记录。
type VectorRecord struct {
	Key      string
	Distance float32
	Meta     map[string]any
}

// VectorStore 封装阿里云 OSS 向量 Bucket 的 PutVectors/QueryVectors/DeleteVectors。
// 它是服务端专用客户端，使用 AccessKey 直连（不涉及客户端 STS）。
type VectorStore struct {
	client *vectors.VectorsClient
	bucket string
}

// NewVectorStore 根据 config 创建向量 Bucket 客户端。配置不全时返回 (nil, nil) —— 由调用方降级。
func NewVectorStore(cfg VectorStoreConfig) (*VectorStore, error) {
	if cfg.AccessKeyID == "" || cfg.AccessKeySecret == "" {
		return nil, errors.New("vector store disabled: ALIYUN_OSS_ACCESS_KEY_ID/SECRET not set")
	}
	if cfg.Bucket == "" {
		return nil, errors.New("vector store disabled: ALIYUN_VECTOR_BUCKET not set")
	}
	if cfg.AccountID == "" {
		return nil, errors.New("vector store disabled: ALIYUN_VECTOR_ACCOUNT_ID not set")
	}
	if cfg.Region == "" {
		cfg.Region = "cn-shanghai"
	}

	ossCfg := oss.LoadDefaultConfig().
		WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.AccessKeySecret)).
		WithRegion(cfg.Region).
		WithAccountId(cfg.AccountID)

	client := vectors.NewVectorsClient(ossCfg)
	return &VectorStore{client: client, bucket: cfg.Bucket}, nil
}

// Enabled 用于判断是否可调用。
func (s *VectorStore) Enabled() bool {
	return s != nil && s.client != nil && s.bucket != ""
}

// PutVector 写入（或更新）一条向量。
//   - indexName: OSS 向量索引名（需先在控制台创建）
//   - key:       唯一标识（通常用业务 ID）
//   - vector:    embedding
//   - metadata:  可选业务字段，可用于 Filter 过滤
func (s *VectorStore) PutVector(ctx context.Context, indexName, key string, vector []float32, metadata map[string]any) error {
	if !s.Enabled() {
		return errors.New("vector store disabled")
	}

	req := &vectors.PutVectorsRequest{
		Bucket:    oss.Ptr(s.bucket),
		IndexName: oss.Ptr(indexName),
		Vectors: []map[string]any{
			{
				"key":  key,
				"data": map[string]any{"float32": vector},
				"metadata": withDefaults(metadata, map[string]any{
					"updated_at": time.Now().UTC().Format(time.RFC3339),
				}),
			},
		},
	}

	_, err := s.client.PutVectors(ctx, req)
	if err != nil {
		return fmt.Errorf("PutVectors(%s/%s) failed: %w", indexName, key, err)
	}
	return nil
}

// QueryByVector 在指定 index 中检索 topK 最相似向量。
// 返回的 Distance 越小表示越相似（OSS 默认 cosine 距离）。
func (s *VectorStore) QueryByVector(ctx context.Context, indexName string, query []float32, topK int, filter map[string]any) ([]VectorRecord, error) {
	if !s.Enabled() {
		return nil, errors.New("vector store disabled")
	}
	if topK <= 0 {
		topK = 10
	}

	req := &vectors.QueryVectorsRequest{
		Bucket:         oss.Ptr(s.bucket),
		IndexName:      oss.Ptr(indexName),
		QueryVector:    map[string]any{"float32": query},
		TopK:           oss.Ptr(topK),
		ReturnMetadata: oss.Ptr(true),
		ReturnDistance: oss.Ptr(true),
	}
	if len(filter) > 0 {
		req.Filter = filter
	}

	result, err := s.client.QueryVectors(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("QueryVectors(%s) failed: %w", indexName, err)
	}

	records := make([]VectorRecord, 0, len(result.Vectors))
	for _, v := range result.Vectors {
		rec := VectorRecord{Meta: v}
		if k, ok := v["key"].(string); ok {
			rec.Key = k
		}
		if d, ok := parseFloat32(v["distance"]); ok {
			rec.Distance = d
		}
		// 把 key/distance 从 Meta 移除便于序列化
		delete(rec.Meta, "key")
		delete(rec.Meta, "distance")
		records = append(records, rec)
	}
	return records, nil
}

// DeleteVectors 按 key 删除向量（最多 1000 条/次）。
func (s *VectorStore) DeleteVectors(ctx context.Context, indexName string, keys []string) error {
	if !s.Enabled() {
		return errors.New("vector store disabled")
	}
	if len(keys) == 0 {
		return nil
	}
	if len(keys) > 1000 {
		keys = keys[:1000]
	}

	req := &vectors.DeleteVectorsRequest{
		Bucket:    oss.Ptr(s.bucket),
		IndexName: oss.Ptr(indexName),
		Keys:      keys,
	}
	if _, err := s.client.DeleteVectors(ctx, req); err != nil {
		return fmt.Errorf("DeleteVectors(%s, %d keys) failed: %w", indexName, len(keys), err)
	}
	return nil
}

func (s *VectorStore) AsyncPut(indexName, key string, vector []float32, metadata map[string]any) {
	if !s.Enabled() {
		return
	}
	idx, k, vec, meta := indexName, key, vector, metadata
	store := s
	asyncPutWithRetry(fmt.Sprintf("put %s/%s", idx, k), func(ctx context.Context) error {
		return store.PutVector(ctx, idx, k, vec, meta)
	})
}

// AsyncDelete 后台删除向量。
func (s *VectorStore) AsyncDelete(indexName string, keys []string) {
	if !s.Enabled() {
		return
	}
	idx, k := indexName, keys
	store := s
	asyncDeleteWithRetry(fmt.Sprintf("delete %s/%v", idx, k), func(ctx context.Context) error {
		return store.DeleteVectors(ctx, idx, k)
	})
}

// withDefaults 合并 src 与 defaults（defaults 不覆盖 src 已有值）。
func withDefaults(src map[string]any, defaults map[string]any) map[string]any {
	out := make(map[string]any, len(src)+len(defaults))
	for k, v := range defaults {
		out[k] = v
	}
	for k, v := range src {
		out[k] = v
	}
	return out
}

// parseFloat32 容忍 JSON 解码后 float32 / float64 / json.Number 的差异。
func parseFloat32(v any) (float32, bool) {
	switch n := v.(type) {
	case float32:
		return n, true
	case float64:
		return float32(n), true
	case int:
		return float32(n), true
	case int64:
		return float32(n), true
	}
	return 0, false
}
