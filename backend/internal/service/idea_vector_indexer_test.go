package service

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/model"
)

type mockVectorBackend struct {
	putMeta   map[string]any
	putCalled bool
	delCalled bool
	delKeys   []string
}

func (m *mockVectorBackend) Enabled() bool { return true }
func (m *mockVectorBackend) PutVector(_ context.Context, _, _ string, _ []float32, metadata map[string]any) error {
	m.putCalled = true
	m.putMeta = metadata
	return nil
}
func (m *mockVectorBackend) QueryByVector(_ context.Context, _ string, _ []float32, _ int, _ map[string]any) ([]VectorRecord, error) {
	return nil, nil
}
func (m *mockVectorBackend) DeleteVectors(_ context.Context, _ string, keys []string) error {
	m.delCalled = true
	m.delKeys = keys
	return nil
}
func (m *mockVectorBackend) AsyncPut(_, _ string, _ []float32, metadata map[string]any) {
	m.putCalled = true
	m.putMeta = metadata
}
func (m *mockVectorBackend) AsyncDelete(_ string, keys []string) {
	m.delCalled = true
	m.delKeys = keys
}

func TestIndexIdea_NonActiveTriggersDelete(t *testing.T) {
	store := &mockVectorBackend{}
	embed := NewEmbeddingService("sk-test", "", "text-embedding-v4", 1536)
	indexer := NewIdeaVectorIndexer(nil, embed, store, "ideas")
	indexer.IndexIdea(&model.Idea{ID: "idea-1", Status: model.IdeaStatusBuried})
	time.Sleep(50 * time.Millisecond)
	assert.True(t, store.delCalled)
	assert.Equal(t, []string{"idea-1"}, store.delKeys)
}

func TestBuildIdeaEmbeddingText(t *testing.T) {
	text := buildIdeaEmbeddingText(&model.Idea{
		Title:       "Title",
		Category:    "AI",
		Description: "Desc",
		Tags:        `["go"]`,
	})
	assert.Contains(t, text, "Title")
	assert.Contains(t, text, "分类：AI")
	assert.Contains(t, text, "Desc")
}

func TestNormalizeSearchOptions_Defaults(t *testing.T) {
	opts := NormalizeSearchOptions(SearchOptions{})
	assert.InDelta(t, 0.3, opts.Threshold, 0.001)
	assert.Equal(t, 10, opts.Limit)
}

func TestFallbackSimilaritySearcher_UsesPrimary(t *testing.T) {
	primary := &mockSimilaritySearcher{matches: []IdeaMatch{{Similarity: 0.9}}}
	fallback := &mockSimilaritySearcher{matches: []IdeaMatch{{Similarity: 0.1}}}
	fb := NewFallbackSimilaritySearcher(primary, fallback)
	matches, err := fb.Search("q", SearchOptions{Limit: 5})
	require.NoError(t, err)
	assert.Len(t, matches, 1)
	assert.InDelta(t, 0.9, matches[0].Similarity, 0.001)
}

func TestFallbackSimilaritySearcher_FallsBackOnError(t *testing.T) {
	primary := &mockSimilaritySearcher{err: assert.AnError}
	fallback := &mockSimilaritySearcher{matches: []IdeaMatch{{Similarity: 0.5}}}
	fb := NewFallbackSimilaritySearcher(primary, fallback)
	matches, err := fb.Search("q", SearchOptions{Limit: 5})
	require.NoError(t, err)
	assert.Len(t, matches, 1)
}
