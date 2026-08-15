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

func TestUpsertDocs(t *testing.T) {
	t.Parallel()

	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/collections/ideas/docs/upsert", r.URL.Path)
		raw, _ := io.ReadAll(r.Body)
		require.NoError(t, json.Unmarshal(raw, &gotBody))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"message":"Success","request_id":"upsert-1","output":[{"doc_op":"insert","id":"idea-1","code":0,"message":""}]}`))
	}))
	t.Cleanup(srv.Close)

	client, err := dashvector.NewClient(dashvector.Config{Endpoint: srv.URL, APIKey: "k"})
	require.NoError(t, err)

	resp, err := client.UpsertDocs(context.Background(), "ideas", dashvector.UpsertDocsRequest{
		Docs: []dashvector.Doc{{
			ID:     "idea-1",
			Vector: []float32{0.1, 0.2},
			Fields: map[string]any{"title": "hello"},
		}},
	})
	require.NoError(t, err)
	assert.Equal(t, "upsert-1", resp.RequestID)
	assert.Equal(t, "idea-1", gotBody["docs"].([]any)[0].(map[string]any)["id"])
}

func TestQuery(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/v1/collections/ideas/query", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"request_id":"q-1","output":[{"id":"idea-1","score":0.2,"fields":{"title":"hello"}}]}`))
	}))
	t.Cleanup(srv.Close)

	client, err := dashvector.NewClient(dashvector.Config{Endpoint: srv.URL, APIKey: "k"})
	require.NoError(t, err)

	resp, err := client.Query(context.Background(), "ideas", dashvector.QueryRequest{
		Vector: []float32{0.1, 0.2},
		TopK:   5,
	})
	require.NoError(t, err)
	require.Len(t, resp.Output, 1)
	assert.Equal(t, "idea-1", resp.Output[0].ID)
	assert.InDelta(t, 0.2, resp.Output[0].Score, 0.001)
}

func TestDeleteDocs(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodDelete, r.Method)
		assert.Equal(t, "/v1/collections/ideas/docs", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"request_id":"del-1"}`))
	}))
	t.Cleanup(srv.Close)

	client, err := dashvector.NewClient(dashvector.Config{Endpoint: srv.URL, APIKey: "k"})
	require.NoError(t, err)

	resp, err := client.DeleteDocs(context.Background(), "ideas", dashvector.DeleteDocsRequest{IDs: []string{"idea-1"}})
	require.NoError(t, err)
	assert.Equal(t, "del-1", resp.RequestID)
}

func TestScoreToDistance(t *testing.T) {
	t.Parallel()
	assert.Equal(t, float32(0.2), dashvector.ScoreToDistance(0.2, dashvector.MetricCosine))
	assert.Equal(t, float32(-1.5), dashvector.ScoreToDistance(1.5, dashvector.MetricDotProduct))
}
