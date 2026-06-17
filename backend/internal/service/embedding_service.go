package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// EmbeddingService 通过阿里云 DashScope（百炼）的 OpenAI 兼容接口生成文本向量。
// 默认模型 text-embedding-v3，支持 1024/768/512/256/128/64 维。
type EmbeddingService struct {
	apiKey     string
	baseURL    string
	model      string
	dimensions int
	client     *http.Client
}

func NewEmbeddingService(apiKey, baseURL, model string, dimensions int) *EmbeddingService {
	if baseURL == "" {
		baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
	}
	if model == "" {
		model = "text-embedding-v3"
	}
	if dimensions <= 0 {
		dimensions = 1024
	}
	return &EmbeddingService{
		apiKey:     apiKey,
		baseURL:    strings.TrimRight(baseURL, "/"),
		model:      model,
		dimensions: dimensions,
		client:     &http.Client{Timeout: 30 * time.Second},
	}
}

// Enabled 返回 true 表示已配置 API key，可以真实调用。
func (s *EmbeddingService) Enabled() bool {
	return s.apiKey != ""
}

type embeddingRequest struct {
	Model      string   `json:"model"`
	Input      []string `json:"input"`
	Dimensions int      `json:"dimensions"`
}

type embeddingResponse struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
	} `json:"data"`
	Usage struct {
		TotalTokens int `json:"total_tokens"`
	} `json:"usage"`
}

// Embed 将单段文本转为 float32 向量。当 apiKey 为空时返回 nil + error，调用方需自行降级。
func (s *EmbeddingService) Embed(ctx context.Context, text string) ([]float32, error) {
	if !s.Enabled() {
		return nil, fmt.Errorf("embedding service disabled: DASHSCOPE_API_KEY not set")
	}
	if strings.TrimSpace(text) == "" {
		return nil, fmt.Errorf("embedding input text is empty")
	}

	vectors, err := s.EmbedBatch(ctx, []string{text})
	if err != nil {
		return nil, err
	}
	if len(vectors) == 0 {
		return nil, fmt.Errorf("embedding returned no vectors")
	}
	return vectors[0], nil
}

// EmbedBatch 批量生成向量（DashScope 单次最多 10 条，这里自动分片）。
func (s *EmbeddingService) EmbedBatch(ctx context.Context, texts []string) ([][]float32, error) {
	if !s.Enabled() {
		return nil, fmt.Errorf("embedding service disabled")
	}
	if len(texts) == 0 {
		return nil, nil
	}

	const batchSize = 10
	out := make([][]float32, 0, len(texts))

	for i := 0; i < len(texts); i += batchSize {
		end := i + batchSize
		if end > len(texts) {
			end = len(texts)
		}
		chunk := texts[i:end]

		body, _ := json.Marshal(embeddingRequest{
			Model:      s.model,
			Input:      chunk,
			Dimensions: s.dimensions,
		})

		req, err := http.NewRequestWithContext(ctx, "POST", s.baseURL+"/embeddings", bytes.NewReader(body))
		if err != nil {
			return nil, fmt.Errorf("build embedding request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+s.apiKey)

		resp, err := s.client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("embedding request failed: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(resp.Body)
			return nil, fmt.Errorf("embedding returned %d: %s", resp.StatusCode, string(b))
		}

		var result embeddingResponse
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return nil, fmt.Errorf("failed to decode embedding response: %w", err)
		}
		for _, d := range result.Data {
			out = append(out, d.Embedding)
		}
	}

	return out, nil
}

// Dimensions 返回当前配置的向量维度。
func (s *EmbeddingService) Dimensions() int {
	return s.dimensions
}
