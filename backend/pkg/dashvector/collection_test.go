package dashvector_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/pkg/dashvector"
)

func TestNewClient_Validation(t *testing.T) {
	t.Parallel()

	_, err := dashvector.NewClient(dashvector.Config{})
	assert.ErrorContains(t, err, "endpoint is required")

	_, err = dashvector.NewClient(dashvector.Config{Endpoint: "https://example.com"})
	assert.ErrorContains(t, err, "api key is required")
}

func TestCreateCollection_SingleVector(t *testing.T) {
	t.Parallel()

	var gotAuth string
	var gotBody map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "/v1/collections", r.URL.Path)
		gotAuth = r.Header.Get("dashvector-auth-token")
		raw, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(raw, &gotBody))

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"request_id":"19215409-ea66-4db9-8764-26ce2eb5bb99","code":0,"message":""}`))
	}))
	t.Cleanup(srv.Close)

	dim := 4
	client, err := dashvector.NewClient(dashvector.Config{
		Endpoint: srv.URL,
		APIKey:   "test-api-key",
	})
	require.NoError(t, err)

	resp, err := client.CreateCollection(context.Background(), dashvector.CreateCollectionRequest{
		Name:      "quickstart",
		Dimension: &dim,
		Metric:    dashvector.MetricDotProduct,
		FieldsSchema: map[string]dashvector.FieldType{
			"name":   dashvector.FieldString,
			"weight": dashvector.FieldFloat,
			"age":    dashvector.FieldInt,
			"id":     dashvector.FieldLong,
		},
	})
	require.NoError(t, err)
	assert.Equal(t, "test-api-key", gotAuth)
	assert.Equal(t, "quickstart", gotBody["name"])
	assert.EqualValues(t, 4, gotBody["dimension"])
	assert.Equal(t, "dotproduct", gotBody["metric"])
	assert.Equal(t, "19215409-ea66-4db9-8764-26ce2eb5bb99", resp.RequestID)
	assert.Equal(t, 0, resp.Code)
}

func TestCreateCollection_MultiVector(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/collections", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"request_id":"819b6ffe-bf44-42a4-8efa-a53a93d93bcd","code":0,"message":""}`))
	}))
	t.Cleanup(srv.Close)

	client, err := dashvector.NewClient(dashvector.Config{
		Endpoint: srv.URL,
		APIKey:   "test-api-key",
	})
	require.NoError(t, err)

	titleDim, contentDim := 4, 6
	resp, err := client.CreateCollection(context.Background(), dashvector.NewMultiVectorCollectionRequest(
		"multi_vector_demo",
		map[string]dashvector.VectorParam{
			"title": {Dimension: &titleDim},
			"content": {
				Dimension: &contentDim,
				Metric:    dashvector.MetricDotProduct,
			},
		},
		map[string]dashvector.VectorParam{
			"abstruct": {Metric: dashvector.MetricDotProduct},
			"keywords": {Metric: dashvector.MetricDotProduct},
		},
		map[string]dashvector.FieldType{
			"author": dashvector.FieldString,
		},
	))
	require.NoError(t, err)
	assert.Equal(t, "819b6ffe-bf44-42a4-8efa-a53a93d93bcd", resp.RequestID)
}

func TestCreateCollection_APIError(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"request_id":"err-1","code":400,"message":"collection already exists"}`))
	}))
	t.Cleanup(srv.Close)

	client, err := dashvector.NewClient(dashvector.Config{
		Endpoint: srv.URL,
		APIKey:   "test-api-key",
	})
	require.NoError(t, err)

	dim := 1536
	_, err = client.CreateCollection(context.Background(), dashvector.CreateCollectionRequest{
		Name:      "ideas",
		Dimension: &dim,
		Metric:    dashvector.MetricCosine,
	})
	require.Error(t, err)

	var apiErr *dashvector.APIError
	require.ErrorAs(t, err, &apiErr)
	assert.Equal(t, 400, apiErr.Code)
	assert.Equal(t, http.StatusBadRequest, apiErr.HTTPStatus)
	assert.Equal(t, "collection already exists", apiErr.Message)
	assert.Equal(t, "err-1", apiErr.RequestID)
}
