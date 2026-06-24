package service

import (
	"fmt"
	"strings"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// SimilaritySearcher 抽象 idea 的相似度检索。
// 默认实现 [LikeSimilaritySearcher] 用 MySQL LIKE + 长度评分做简易降级；
// 生产场景应在 main.go 中注入 [VectorSimilaritySearcher]（OSS 向量 Bucket）覆盖默认实现。
type SimilaritySearcher interface {
	Search(queryText string, threshold float64, limit int) ([]IdeaMatch, error)
}

// LikeSimilaritySearcher 是 MySQL 环境下的默认降级实现：
// 用 LIKE 做粗筛（命中即候选），然后用"最长公共子串 / 较短字符串长度"打分。
//
// 评分规则（保证与向量结果在 [0,1] 区间可比）：
//   - 完全包含（query 是 title/desc 的子串）           → ~0.7-1.0
//   - title/desc 包含 query 中的某个 token              → ~0.4-0.6
//   - 否则                                              → 不进结果
//
// 仅作为向量 Bucket 不可用时的兜底，不追求精度。
type LikeSimilaritySearcher struct {
	db *gorm.DB
}

func NewLikeSimilaritySearcher(db *gorm.DB) *LikeSimilaritySearcher {
	return &LikeSimilaritySearcher{db: db}
}

func (s *LikeSimilaritySearcher) Search(queryText string, threshold float64, limit int) ([]IdeaMatch, error) {
	queryText = strings.TrimSpace(queryText)
	if queryText == "" {
		return nil, nil
	}
	if threshold == 0 {
		threshold = 0.3
	}
	if limit <= 0 {
		limit = 10
	}

	// 第一步：LIKE 粗筛。把 query 拆成 token，每个 token 都查一次（OR 关系）。
	tokens := tokenize(queryText)
	if len(tokens) == 0 {
		return nil, nil
	}
	likeConditions := strings.Repeat("title LIKE ? OR description LIKE ? OR ", len(tokens))
	likeConditions = strings.TrimSuffix(likeConditions, " OR ")
	args := make([]any, 0, len(tokens)*2)
	for _, t := range tokens {
		args = append(args, "%"+t+"%", "%"+t+"%")
	}

	var ideas []model.Idea
	err := s.db.Where("status = 'active' AND ("+likeConditions+")", args...).
		Limit(limit).
		Find(&ideas).Error
	if err != nil {
		return nil, fmt.Errorf("like search failed: %w", err)
	}

	// 第二步：内存中用 LCS 评分
	matches := make([]IdeaMatch, 0, len(ideas))
	queryLower := strings.ToLower(queryText)
	for _, idea := range ideas {
		score := bestMatchScore(queryLower, strings.ToLower(idea.Title+" "+idea.Description), tokens)
		if score >= threshold {
			matches = append(matches, IdeaMatch{Idea: idea, Similarity: score})
		}
	}

	// 按分数降序
	for i := 0; i < len(matches); i++ {
		for j := i + 1; j < len(matches); j++ {
			if matches[j].Similarity > matches[i].Similarity {
				matches[i], matches[j] = matches[j], matches[i]
			}
		}
	}

	if len(matches) > limit {
		matches = matches[:limit]
	}
	return matches, nil
}

// tokenize 把 query 拆成可用于 LIKE 的 token。
// 中文：按字符切（2-3 字为 1 个 token，覆盖常见词）
// 英文：按空白切，长度 < 2 的丢弃
func tokenize(s string) []string {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "" {
		return nil
	}

	// 简单策略：按空白切，再加上滑窗（覆盖中文无空格场景）
	tokens := strings.Fields(s)
	out := make([]string, 0, len(tokens)*2)
	for _, t := range tokens {
		if len([]rune(t)) >= 2 {
			out = append(out, t)
		}
	}

	// 中文滑窗：2 字为一组（避免单字噪音过大）
	runes := []rune(s)
	if len(runes) >= 2 && len(tokens) <= 1 {
		for i := 0; i+2 <= len(runes); i++ {
			out = append(out, string(runes[i:i+2]))
		}
	}

	// 去重
	seen := make(map[string]bool, len(out))
	uniq := out[:0]
	for _, t := range out {
		if !seen[t] {
			seen[t] = true
			uniq = append(uniq, t)
		}
	}
	return uniq
}

// bestMatchScore 计算一个 idea 文本相对 query 的相似度评分（0-1）。
//   - 完整 query 是 idea 的子串：高分（0.8）
//   - 多个 token 命中：按命中率加权（0.4-0.7）
//   - 无任何 token 命中：0
func bestMatchScore(queryLower, ideaLower string, tokens []string) float64 {
	// 整串包含
	if strings.Contains(ideaLower, queryLower) {
		return 0.85
	}

	// token 命中率
	if len(tokens) == 0 {
		return 0
	}
	hits := 0
	for _, t := range tokens {
		if strings.Contains(ideaLower, t) {
			hits++
		}
	}
	if hits == 0 {
		return 0
	}
	hitRate := float64(hits) / float64(len(tokens))
	// hitRate * 0.7 保证：少量命中（如 1/5 token）仍有 0.14，会被 0.3 阈值过滤掉
	// 大量命中（如 4/5）→ 0.56，进入结果集
	return hitRate * 0.7
}
