package mcp

import (
	"errors"
	"sync"
	"time"
)

// MCP 限速：每个 agent 1 req/s，防止 AI Agent 高频轮询/重试打爆后端。
//
// 令牌桶参数：速率 1/s、容量 1 —— 即任意 1 秒窗口内至多放行 1 次调用
//（第 1 次立即通过，紧随的第 2 次被拒，满 1 秒后桶恢复）。
// 匿名调用（stdio 未带 key 的只读浏览）共享一个 "anonymous" 桶：
// 远程 HTTP MCP 强制 Authorization，匿名只会出现在本地 stdio，共享桶即够用。
//
// 被限流时返回明确错误，MCP 客户端（LLM）能读到并自行退避重试。

const (
	// mcpRatePerAgent 是每个 agent 的限速速率（每秒允许的请求数）。
	mcpRatePerAgent = 1
	// mcpAnonKey 是匿名调用的共享桶 key。
	mcpAnonKey = "anonymous"
	// mcpLimiterTTL 是桶条目的闲置回收时间，防止 agent 数量增长导致 map 无界膨胀。
	mcpLimiterTTL = 30 * time.Minute
)

// ErrRateLimited 是限流错误的稳定文案，供两条调用路径（桥接/专属工具）共用。
var ErrRateLimited = errors.New(
	"rate limit exceeded: Deimos MCP allows 1 request per second per agent — " +
		"wait at least one second before retrying, and avoid tight retry loops")

// agentRateLimiter 是单 key 的令牌桶。容量=速率(1)，严格每秒一次。
type agentRateLimiter struct {
	tokens   float64   // 当前令牌数，最大 1
	lastSeen time.Time // 最后访问时间，用于惰性回收
}

// allow 在 now 时刻尝试取一个令牌。
func (l *agentRateLimiter) allow(now time.Time) bool {
	// 按距离上次的时间差补充令牌，上限 1
	elapsed := now.Sub(l.lastSeen).Seconds()
	l.lastSeen = now
	l.tokens += elapsed * mcpRatePerAgent
	if l.tokens > mcpRatePerAgent {
		l.tokens = mcpRatePerAgent
	}
	if l.tokens >= 1 {
		l.tokens -= 1
		return true
	}
	return false
}

// RateLimiter 按 key（agent ID / anonymous）维护令牌桶。
// 并发安全；nowFn 可注入以便测试。
type RateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*agentRateLimiter
	nowFn   func() time.Time
}

// NewRateLimiter 创建限速器。nowFn 为 nil 时用 time.Now。
func NewRateLimiter(nowFn func() time.Time) *RateLimiter {
	if nowFn == nil {
		nowFn = time.Now
	}
	return &RateLimiter{buckets: make(map[string]*agentRateLimiter), nowFn: nowFn}
}

// Allow 检查 key（agent ID）是否放行本次调用。
// key 为空时按匿名共享桶处理。
func (r *RateLimiter) Allow(key string) bool {
	if key == "" {
		key = mcpAnonKey
	}
	now := r.nowFn()

	r.mu.Lock()
	defer r.mu.Unlock()

	// 每 4096 次调用做一次惰性清扫，回收长期闲置的桶
	if len(r.buckets) > 4096 {
		for k, b := range r.buckets {
			if now.Sub(b.lastSeen) > mcpLimiterTTL {
				delete(r.buckets, k)
			}
		}
	}

	b, ok := r.buckets[key]
	if !ok {
		// 新桶赠送 1 个令牌：首次调用立即放行，之后严格按 1/s 补充。
		b = &agentRateLimiter{tokens: 1, lastSeen: now}
		r.buckets[key] = b
	}
	return b.allow(now)
}
