package service

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/model"
)

// mockSimilaritySearcher is defined in dedup_engine_test.go (same package).

func newIdeaServiceWithMock(mock *mockSimilaritySearcher) *IdeaService {
	return NewIdeaServiceWithDedup(nil, NewDedupEngineWithSearcher(mock))
}

func TestIdeaService_Search_DefaultThresholdAndLimit(t *testing.T) {
	mock := &mockSimilaritySearcher{}
	svc := newIdeaServiceWithMock(mock)

	_, err := svc.Search("query", 0, 0)
	require.NoError(t, err)
	assert.InDelta(t, 0.3, mock.lastThreshold, 0.001, "threshold=0 应回退到默认 0.3")
	assert.Equal(t, 10, mock.lastLimit, "limit=0 应回退到默认 10")
}

func TestIdeaService_Search_PreservesExplicitThresholdAndLimit(t *testing.T) {
	mock := &mockSimilaritySearcher{}
	svc := newIdeaServiceWithMock(mock)

	_, err := svc.Search("query", 0.5, 20)
	require.NoError(t, err)
	assert.InDelta(t, 0.5, mock.lastThreshold, 0.001)
	assert.Equal(t, 20, mock.lastLimit)
}

func TestIdeaService_Search_ReturnsMatches(t *testing.T) {
	expected := []IdeaMatch{{Idea: model.Idea{Title: "found"}, Similarity: 0.8}}
	mock := &mockSimilaritySearcher{matches: expected}
	svc := newIdeaServiceWithMock(mock)

	matches, err := svc.Search("query", 0.4, 5)
	require.NoError(t, err)
	assert.Equal(t, expected, matches)
}

func TestIdeaService_Search_PropagatesError(t *testing.T) {
	mock := &mockSimilaritySearcher{err: errors.New("search failed")}
	svc := newIdeaServiceWithMock(mock)

	_, err := svc.Search("query", 0, 0)
	require.Error(t, err)
}
