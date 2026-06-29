package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/wanye/ideaevo/internal/model"
)

type stubSearcher struct {
	calls []SearchOptions
}

func (s *stubSearcher) Search(queryText string, opts SearchOptions) ([]IdeaMatch, error) {
	s.calls = append(s.calls, opts)
	return nil, nil
}

func TestIdeaContextRetriever_Retrieve_UserAndGlobal(t *testing.T) {
	searcher := &stubSearcher{}
	embed := NewEmbeddingService("test-key", "", "", 1536)
	r := NewIdeaContextRetriever(searcher, embed, NewIdeaService(nil))
	session := &model.ChatSession{UserID: "user-1"}

	_, err := r.Retrieve(session, "做一个笔记工具", nil)
	assert.NoError(t, err)
	assert.Len(t, searcher.calls, 2)
	assert.Equal(t, "user-1", searcher.calls[0].OwnerUserID)
	assert.Equal(t, "active", searcher.calls[1].Status)
}

type fnSearcher struct {
	fn func(queryText string, opts SearchOptions) ([]IdeaMatch, error)
}

func (f *fnSearcher) Search(queryText string, opts SearchOptions) ([]IdeaMatch, error) {
	return f.fn(queryText, opts)
}

func TestFindSimilarForRegister_NoSearcher(t *testing.T) {
	svc := NewIdeaService(nil)
	matches, err := svc.FindSimilarForRegister("u1", "title", "desc")
	assert.NoError(t, err)
	assert.Nil(t, matches)
}

func TestFindSimilarForRegister_MergesResults(t *testing.T) {
	searcher := &fnSearcher{
		fn: func(queryText string, opts SearchOptions) ([]IdeaMatch, error) {
			if opts.OwnerUserID != "" {
				return []IdeaMatch{{Idea: model.Idea{ID: "mine"}, Similarity: 0.85}}, nil
			}
			return []IdeaMatch{{Idea: model.Idea{ID: "global"}, Similarity: 0.82}}, nil
		},
	}
	svc := NewIdeaService(nil)
	svc.SetSearcher(searcher)

	matches, err := svc.FindSimilarForRegister("u1", "AI notes", "desc")
	assert.NoError(t, err)
	assert.Len(t, matches, 2)
	assert.Equal(t, "mine", matches[0].Idea.ID)
	assert.InDelta(t, 0.85, MaxIdeaMatchSimilarity(matches), 0.001)
}

func TestFindSimilarForRegister_SortedBySimilarity(t *testing.T) {
	searcher := &fnSearcher{
		fn: func(queryText string, opts SearchOptions) ([]IdeaMatch, error) {
			if opts.OwnerUserID != "" {
				return []IdeaMatch{{Idea: model.Idea{ID: "low"}, Similarity: 0.81}}, nil
			}
			return []IdeaMatch{{Idea: model.Idea{ID: "high"}, Similarity: 0.95}}, nil
		},
	}
	svc := NewIdeaService(nil)
	svc.SetSearcher(searcher)

	matches, err := svc.FindSimilarForRegister("u1", "t", "d")
	assert.NoError(t, err)
	assert.Equal(t, "high", matches[0].Idea.ID)
	assert.InDelta(t, 0.95, MaxIdeaMatchSimilarity(matches), 0.001)
}
