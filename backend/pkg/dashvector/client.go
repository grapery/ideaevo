package dashvector

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

const (
	defaultHTTPTimeout = 30 * time.Second
	authHeader         = "dashvector-auth-token"
)

// Client 是百炼 DashVector Cluster 的 HTTP 客户端。
// 认证使用 API Key（dashvector-auth-token），请求发往 Cluster Endpoint。
type Client struct {
	endpoint string
	apiKey   string
	http     *http.Client
}

// Config 是 Client 构造参数。
type Config struct {
	// Endpoint 为 Cluster 详情页中的 Endpoint，例如
	// https://vrs-cn-xxxx.dashvector.cn-hangzhou.aliyuncs.com
	Endpoint string
	// APIKey 为百炼 API Key（与 DashScope 共用或独立，取决于控制台配置）。
	APIKey string
	// HTTPClient 可选；未设置时使用 30s 超时默认客户端。
	HTTPClient *http.Client
}

// NewClient 根据 Config 创建客户端。Endpoint 与 APIKey 均不能为空。
func NewClient(cfg Config) (*Client, error) {
	endpoint := strings.TrimSpace(cfg.Endpoint)
	apiKey := strings.TrimSpace(cfg.APIKey)
	if endpoint == "" {
		return nil, fmt.Errorf("dashvector: endpoint is required")
	}
	if apiKey == "" {
		return nil, fmt.Errorf("dashvector: api key is required")
	}
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: defaultHTTPTimeout}
	}
	return &Client{
		endpoint: strings.TrimRight(endpoint, "/"),
		apiKey:   apiKey,
		http:     httpClient,
	}, nil
}

// Endpoint 返回规范化后的 Cluster Endpoint。
func (c *Client) Endpoint() string {
	if c == nil {
		return ""
	}
	return c.endpoint
}

func (c *Client) postJSON(ctx context.Context, path string, payload any) (*APIResponse, error) {
	var result APIResponse
	if err := c.request(ctx, http.MethodPost, path, payload, &result); err != nil {
		return &result, err
	}
	return &result, nil
}

func (c *Client) deleteJSON(ctx context.Context, path string, payload any) (*APIResponse, error) {
	var result APIResponse
	if err := c.request(ctx, http.MethodDelete, path, payload, &result); err != nil {
		return &result, err
	}
	return &result, nil
}

func (c *Client) request(ctx context.Context, method, path string, payload any, dest any) error {
	if c == nil {
		return fmt.Errorf("dashvector: client is nil")
	}

	var bodyReader io.Reader
	if payload != nil {
		body, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("dashvector: marshal request: %w", err)
		}
		bodyReader = bytes.NewReader(body)
	}

	url := c.endpoint + path
	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return fmt.Errorf("dashvector: build request: %w", err)
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set(authHeader, c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("dashvector: request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("dashvector: read response: %w", err)
	}

	if dest != nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, dest); err != nil {
			return fmt.Errorf("dashvector: decode response: %w", err)
		}
	}

	var result APIResponse
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &result)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &APIError{
			Code:       result.Code,
			Message:    firstNonEmpty(result.Message, string(raw)),
			RequestID:  result.RequestID,
			HTTPStatus: resp.StatusCode,
		}
	}
	if result.Code != 0 {
		return &APIError{
			Code:       result.Code,
			Message:    result.Message,
			RequestID:  result.RequestID,
			HTTPStatus: resp.StatusCode,
		}
	}
	return nil
}

func collectionPath(name string) string {
	return "/v1/collections/" + urlPathEscape(name)
}

func urlPathEscape(name string) string {
	// Collection 名称由业务控制（字母数字下划线），直接拼接即可。
	return strings.TrimSpace(name)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
