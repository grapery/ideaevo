package service

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/model"
)

// mockSimilaritySearcher is shared by dedup_engine_test.go and idea_service_test.go.
type mockSimilaritySearcher struct {
	matches      []IdeaMatch
	err          error
	lastQuery    string
	lastThreshold float64
	lastLimit    int
	calls        int
}

func (m *mockSimilaritySearcher) Search(queryText string, threshold float64, limit int) ([]IdeaMatch, error) {
	m.calls++
	m.lastQuery = queryText
	m.lastThreshold = threshold
	m.lastLimit = limit
	if m.err != nil {
		return nil, m.err
	}
	return m.matches, nil
}

func TestDedupEngine_Check_DuplicateDetected(t *testing.T) {
	mock := &mockSimilaritySearcher{
		matches: []IdeaMatch{
			{Idea: model.Idea{Title: "similar"}, Similarity: 0.85},
		},
	}
	d := NewDedupEngineWithSearcher(mock)

	warning, err := d.Check("hello", "world")
	require.NoError(t, err)
	require.NotNil(t, warning)
	assert.True(t, warning.IsDuplicate)
	assert.Len(t, warning.SimilarIdeas, 1)
}

func TestDedupEngine_Check_BelowDuplicateThreshold(t *testing.T) {
	mock := &mockSimilaritySearcher{
		matches: []IdeaMatch{
			{Idea: model.Idea{Title: "vaguely"}, Similarity: 0.5},
		},
	}
	d := NewDedupEngineWithSearcher(mock)

	warning, err := d.Check("hello", "world")
	require.NoError(t, err)
	assert.False(t, warning.IsDuplicate, "0.5 < 0.7 不应判定为重复")
}

func TestDedupEngine_Check_NoMatches(t *testing.T) {
	mock := &mockSimilaritySearcher{matches: []IdeaMatch{}}
	d := NewDedupEngineWithSearcher(mock)

	warning, err := d.Check("brand", "new")
	require.NoError(t, err)
	assert.False(t, warning.IsDuplicate)
	assert.Empty(t, warning.SimilarIdeas)
}

func TestDedupEngine_Check_SearchError(t *testing.T) {
	mock := &mockSimilaritySearcher{err: errors.New("db unavailable")}
	d := NewDedupEngineWithSearcher(mock)

	_, err := d.Check("any", "any")
	require.Error(t, err)
}

func TestDedupEngine_Check_PassesCorrectArgs(t *testing.T) {
	mock := &mockSimilaritySearcher{}
	d := NewDedupEngineWithSearcher(mock)

	_, _ = d.Check("title-here", "desc-here")
	assert.Equal(t, "title-here desc-here", mock.lastQuery)
	assert.InDelta(t, 0.3, mock.lastThreshold, 0.001)
	assert.Equal(t, 5, mock.lastLimit)
}

func TestDedupEngine_Search_Delegates(t *testing.T) {
	expected := []IdeaMatch{{Idea: model.Idea{Title: "x"}, Similarity: 0.9}}
	mock := &mockSimilaritySearcher{matches: expected}
	d := NewDedupEngineWithSearcher(mock)

	matches, err := d.Search("query", 0.5, 10)
	require.NoError(t, err)
	assert.Equal(t, expected, matches)
	assert.Equal(t, 1, mock.calls)
	assert.Equal(t, "query", mock.lastQuery)
}
