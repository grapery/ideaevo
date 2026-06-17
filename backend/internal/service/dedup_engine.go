package service

import (
	"gorm.io/gorm"
)

type DedupEngine struct {
	searcher SimilaritySearcher
}

func NewDedupEngine(db *gorm.DB) *DedupEngine {
	return &DedupEngine{searcher: NewLikeSimilaritySearcher(db)}
}

// NewDedupEngineWithSearcher allows tests to inject a mock [SimilaritySearcher],
// bypassing the MySQL dependency required by [LikeSimilaritySearcher].
func NewDedupEngineWithSearcher(s SimilaritySearcher) *DedupEngine {
	return &DedupEngine{searcher: s}
}

// SetSearcher 在运行时替换底层 searcher。向量检索就绪后由 main.go 注入，
// 默认降级实现为 MySQL LIKE（[LikeSimilaritySearcher]）。
func (d *DedupEngine) SetSearcher(s SimilaritySearcher) {
	if s != nil {
		d.searcher = s
	}
}

type DuplicateResult struct {
	IsDuplicate  bool        `json:"is_duplicate"`
	SimilarIdeas []IdeaMatch `json:"similar_ideas,omitempty"`
}

func (d *DedupEngine) Check(title, description string) (*DuplicateWarning, error) {
	matches, err := d.Search(title+" "+description, 0.3, 5)
	if err != nil {
		return nil, err
	}

	warning := &DuplicateWarning{}
	if len(matches) > 0 && matches[0].Similarity > 0.7 {
		warning.IsDuplicate = true
	}
	warning.SimilarIdeas = matches
	return warning, nil
}

func (d *DedupEngine) Search(queryText string, threshold float64, limit int) ([]IdeaMatch, error) {
	return d.searcher.Search(queryText, threshold, limit)
}
