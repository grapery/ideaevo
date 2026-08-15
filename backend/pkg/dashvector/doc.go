package dashvector

import (
	"context"
	"net/http"
)

// Doc 是 Collection 中的一条向量文档。
type Doc struct {
	ID     string         `json:"id,omitempty"`
	Vector []float32      `json:"vector,omitempty"`
	Fields map[string]any `json:"fields,omitempty"`
}

// UpsertDocsRequest 插入或更新文档。
type UpsertDocsRequest struct {
	Docs      []Doc  `json:"docs"`
	Partition string `json:"partition,omitempty"`
}

// DocOpResult 是单条 upsert 操作结果。
type DocOpResult struct {
	DocOp   string `json:"doc_op"`
	ID      string `json:"id"`
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// UpsertDocsResponse 是 upsert 接口响应。
type UpsertDocsResponse struct {
	APIResponse
	Output []DocOpResult `json:"output"`
}

// UpsertDocs 调用 POST /v1/collections/{name}/docs/upsert。
func (c *Client) UpsertDocs(ctx context.Context, collection string, req UpsertDocsRequest) (*UpsertDocsResponse, error) {
	var resp UpsertDocsResponse
	err := c.request(ctx, http.MethodPost, collectionPath(collection)+"/docs/upsert", req, &resp)
	if err != nil {
		return &resp, err
	}
	return &resp, nil
}

// DeleteDocsRequest 按 ID 删除文档。
type DeleteDocsRequest struct {
	IDs       []string `json:"ids"`
	Partition string   `json:"partition,omitempty"`
}

// DeleteDocs 调用 DELETE /v1/collections/{name}/docs。
func (c *Client) DeleteDocs(ctx context.Context, collection string, req DeleteDocsRequest) (*APIResponse, error) {
	return c.deleteJSON(ctx, collectionPath(collection)+"/docs", req)
}
