package mcp

import (
	"testing"
	"time"
)

func TestRateLimiter_OnePerSecond(t *testing.T) {
	base := time.Date(2026, 8, 28, 12, 0, 0, 0, time.UTC)
	now := base
	rl := NewRateLimiter(func() time.Time { return now })

	// 第 1 次放行
	if !rl.Allow("agent-1") {
		t.Fatal("first call within a fresh bucket should be allowed")
	}
	// 同一秒内的第 2 次必须拒绝
	if rl.Allow("agent-1") {
		t.Fatal("second call in the same second should be rejected")
	}
	// 满 1 秒后恢复
	now = now.Add(1 * time.Second)
	if !rl.Allow("agent-1") {
		t.Fatal("call after a full second should be allowed")
	}
	// 半秒后仍拒绝（令牌未攒满）
	now = now.Add(500 * time.Millisecond)
	if rl.Allow("agent-1") {
		t.Fatal("call half a second later should still be rejected")
	}
}

func TestRateLimiter_BucketsAreIsolated(t *testing.T) {
	base := time.Date(2026, 8, 28, 12, 0, 0, 0, time.UTC)
	now := base
	rl := NewRateLimiter(func() time.Time { return now })

	if !rl.Allow("agent-1") {
		t.Fatal("agent-1 first call should be allowed")
	}
	// agent-2 有独立桶，不受 agent-1 消耗影响
	if !rl.Allow("agent-2") {
		t.Fatal("agent-2 first call should be allowed independently")
	}
	if rl.Allow("agent-1") {
		t.Fatal("agent-1 second call in same second should be rejected")
	}
}

func TestRateLimiter_AnonymousSharedBucket(t *testing.T) {
	base := time.Date(2026, 8, 28, 12, 0, 0, 0, time.UTC)
	now := base
	rl := NewRateLimiter(func() time.Time { return now })

	if !rl.Allow("") {
		t.Fatal("anonymous first call should be allowed")
	}
	// 空 key 与显式 "anonymous" 应命中同一个桶
	if rl.Allow(mcpAnonKey) {
		t.Fatal("anonymous bucket should be shared between empty and explicit key")
	}
}

func TestRateLimiter_LazyCleanup(t *testing.T) {
	now := time.Date(2026, 8, 28, 12, 0, 0, 0, time.UTC)
	rl := NewRateLimiter(func() time.Time { return now })

	// 填入超过清扫阈值的条目
	for i := 0; i < 5000; i++ {
		rl.Allow(string(rune('a'+i%26)) + time.Duration(i).String())
	}
	now = now.Add(2 * mcpLimiterTTL) // 全部闲置过期
	rl.Allow("trigger-cleanup")      // 触发惰性清扫

	rl.mu.Lock()
	size := len(rl.buckets)
	rl.mu.Unlock()
	if size > 100 {
		t.Fatalf("lazy cleanup should evict stale buckets, got %d remaining", size)
	}
}

