// Package dashvector 封装阿里云百炼 DashVector 向量数据库 HTTP API：
// Create Collection、Upsert/Delete Doc、Query 相似检索。
package dashvector

import "fmt"

// Metric 是 Collection 的距离度量方式。
type Metric string

const (
	MetricCosine     Metric = "cosine"
	MetricDotProduct Metric = "dotproduct"
	MetricEuclidean  Metric = "euclidean"
)

// Dtype 是向量数据类型。
type Dtype string

const (
	DtypeFloat Dtype = "FLOAT"
	DtypeInt   Dtype = "INT"
)

// FieldType 是 Collection 预定义 Field 的数据类型。
type FieldType string

const (
	FieldString      FieldType = "STRING"
	FieldFloat       FieldType = "FLOAT"
	FieldInt         FieldType = "INT"
	FieldLong        FieldType = "LONG"
	FieldArrayString FieldType = "ARRAY_STRING"
	FieldArrayInt    FieldType = "ARRAY_INT"
	FieldArrayLong   FieldType = "ARRAY_LONG"
	FieldArrayFloat  FieldType = "ARRAY_FLOAT"
)

// VectorParam 描述多向量 / 稀疏向量字段。
type VectorParam struct {
	Dimension *int   `json:"dimension,omitempty"`
	Metric    Metric `json:"metric,omitempty"`
	Dtype     Dtype  `json:"dtype,omitempty"`
}

// APIResponse 是 DashVector 通用响应体。
type APIResponse struct {
	Code      int    `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"request_id"`
}

// APIError 表示 DashVector 返回的业务错误或 HTTP 失败。
type APIError struct {
	Code       int
	Message    string
	RequestID  string
	HTTPStatus int
}

func (e *APIError) Error() string {
	if e == nil {
		return "dashvector: unknown error"
	}
	if e.HTTPStatus > 0 && e.HTTPStatus != 200 {
		return fmt.Sprintf("dashvector: http %d (code=%d request_id=%s): %s",
			e.HTTPStatus, e.Code, e.RequestID, e.Message)
	}
	return fmt.Sprintf("dashvector: code=%d request_id=%s: %s", e.Code, e.RequestID, e.Message)
}
