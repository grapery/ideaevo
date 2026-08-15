package service

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/model"
)

// mockSimilaritySearcher implements SimilaritySearcher for unit tests (no DB needed).
type mockSimilaritySearcher struct {
	matches   []IdeaMatch
	err       error
	lastQuery string
	lastOpts  SearchOptions
}

func (m *mockSimilaritySearcher) Search(queryText string, opts SearchOptions) ([]IdeaMatch, error) {
	m.lastQuery = queryText
	m.lastOpts = opts
	if m.err != nil {
		return nil, m.err
	}
	return m.matches, nil
}

func (m *mockSimilaritySearcher) Enabled() bool { return true }

func newIdeaServiceWithMock(mock *mockSimilaritySearcher) *IdeaService {
	svc := NewIdeaService(nil)
	svc.SetSearcher(mock)
	return svc
}

func TestIdeaService_Search_DefaultThresholdAndLimit(t *testing.T) {
	mock := &mockSimilaritySearcher{}
	svc := newIdeaServiceWithMock(mock)

	_, err := svc.Search("query", SearchOptions{})
	require.NoError(t, err)
	assert.InDelta(t, 0.3, mock.lastOpts.Threshold, 0.001, "threshold=0 应回退到默认 0.3")
	assert.Equal(t, 10, mock.lastOpts.Limit, "limit=0 应回退到默认 10")
}

func TestIdeaService_Search_PreservesExplicitThresholdAndLimit(t *testing.T) {
	mock := &mockSimilaritySearcher{}
	svc := newIdeaServiceWithMock(mock)

	_, err := svc.Search("query", SearchOptions{Threshold: 0.5, Limit: 20})
	require.NoError(t, err)
	assert.InDelta(t, 0.5, mock.lastOpts.Threshold, 0.001)
	assert.Equal(t, 20, mock.lastOpts.Limit)
}

func TestIdeaService_Search_ReturnsMatches(t *testing.T) {
	expected := []IdeaMatch{{Idea: model.Idea{Title: "found"}, Similarity: 0.8}}
	mock := &mockSimilaritySearcher{matches: expected}
	svc := newIdeaServiceWithMock(mock)

	matches, err := svc.Search("query", SearchOptions{Threshold: 0.4, Limit: 5})
	require.NoError(t, err)
	assert.Equal(t, expected, matches)
}

func TestIdeaService_Search_PropagatesError(t *testing.T) {
	mock := &mockSimilaritySearcher{err: errors.New("search failed")}
	svc := newIdeaServiceWithMock(mock)

	_, err := svc.Search("query", SearchOptions{})
	require.Error(t, err)
}

func TestIdeaService_Search_NoSearcherReturnsError(t *testing.T) {
	svc := NewIdeaService(nil)
	_, err := svc.Search("query", SearchOptions{Threshold: 0.3, Limit: 5})
	require.Error(t, err)
}
