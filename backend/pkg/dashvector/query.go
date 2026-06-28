package dashvector

import (
	"context"
	"net/http"
)

// QueryRequest 是相似性检索请求。
type QueryRequest struct {
	Vector        []float32 `json:"vector,omitempty"`
	ID            string    `json:"id,omitempty"`
	TopK          int       `json:"topk,omitempty"`
	Filter        string    `json:"filter,omitempty"`
	IncludeVector bool      `json:"include_vector,omitempty"`
	OutputFields  []string  `json:"output_fields,omitempty"`
	Partition     string    `json:"partition,omitempty"`
}

// QueryDoc 是检索命中的单条文档。
type QueryDoc struct {
	ID     string         `json:"id"`
	Score  float64        `json:"score"`
	Fields map[string]any `json:"fields,omitempty"`
	Vector []float32      `json:"vector,omitempty"`
}

// QueryResponse 是相似性检索响应。
type QueryResponse struct {
	APIResponse
	Output []QueryDoc `json:"output"`
}

// Query 调用 POST /v1/collections/{name}/query。
func (c *Client) Query(ctx context.Context, collection string, req QueryRequest) (*QueryResponse, error) {
	var resp QueryResponse
	err := c.request(ctx, http.MethodPost, collectionPath(collection)+"/query", req, &resp)
	if err != nil {
		return &resp, err
	}
	return &resp, nil
}

// ScoreToDistance 将 DashVector query score 转为与 OSS 一致的 distance（越小越相似）。
// cosine / euclidean：score 即为距离；dotproduct：转为负分数使较大内积对应较小 distance。
func ScoreToDistance(score float64, metric Metric) float32 {
	switch metric {
	case MetricDotProduct:
		return float32(-score)
	default:
		return float32(score)
	}
}
