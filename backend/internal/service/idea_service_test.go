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
	matches      []IdeaMatch
	err          error
	lastQuery    string
	lastThreshold float64
	lastLimit    int
}

func (m *mockSimilaritySearcher) Search(queryText string, threshold float64, limit int) ([]IdeaMatch, error) {
	m.lastQuery = queryText
	m.lastThreshold = threshold
	m.lastLimit = limit
	if m.err != nil {
		return nil, m.err
	}
	return m.matches, nil
}

func newIdeaServiceWithMock(mock *mockSimilaritySearcher) *IdeaService {
	svc := NewIdeaService(nil)
	svc.SetSearcher(mock)
	return svc
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

func TestIdeaService_Search_NoSearcherReturnsError(t *testing.T) {
	// 未注入 searcher 时，Search 应返回明确错误而非 panic。
	svc := NewIdeaService(nil)
	_, err := svc.Search("query", 0.3, 5)
	require.Error(t, err)
}
