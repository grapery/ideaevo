package dashvector

import "context"

// CreateCollectionRequest 创建 Collection 的请求体。
// 单向量集合：设置 Name、Dimension（及可选 Metric/Dtype/FieldsSchema）。
// 多向量集合：设置 Name、VectorsSchema / SparseVectorsSchema（及可选 FieldsSchema）。
type CreateCollectionRequest struct {
	Name                string                  `json:"name"`
	Dimension           *int                    `json:"dimension,omitempty"`
	Dtype               Dtype                   `json:"dtype,omitempty"`
	Metric              Metric                  `json:"metric,omitempty"`
	FieldsSchema        map[string]FieldType    `json:"fields_schema,omitempty"`
	VectorsSchema       map[string]VectorParam  `json:"vectors_schema,omitempty"`
	SparseVectorsSchema map[string]VectorParam  `json:"sparse_vectors_schema,omitempty"`
	ExtraParams         map[string]any          `json:"extra_params,omitempty"`
}

// CreateCollection 调用 POST /v1/collections 创建新的 Collection。
// 文档：https://help.aliyun.com/zh/document_detail/2568084.html
func (c *Client) CreateCollection(ctx context.Context, req CreateCollectionRequest) (*APIResponse, error) {
	return c.postJSON(ctx, "/v1/collections", req)
}

// NewSingleVectorCollectionRequest 构造单向量 Collection 请求（便捷方法）。
func NewSingleVectorCollectionRequest(name string, dimension int, metric Metric, fields map[string]FieldType) CreateCollectionRequest {
	req := CreateCollectionRequest{
		Name:         name,
		Dimension:    &dimension,
		FieldsSchema: fields,
	}
	if metric != "" {
		req.Metric = metric
	}
	return req
}

// NewMultiVectorCollectionRequest 构造多向量 Collection 请求（便捷方法）。
func NewMultiVectorCollectionRequest(
	name string,
	vectors map[string]VectorParam,
	sparse map[string]VectorParam,
	fields map[string]FieldType,
) CreateCollectionRequest {
	return CreateCollectionRequest{
		Name:                name,
		VectorsSchema:       vectors,
		SparseVectorsSchema: sparse,
		FieldsSchema:        fields,
	}
}
