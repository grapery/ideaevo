package service

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

// 写操作工具二次确认机制。
//
// 目的：LLM 决定调用 register_idea / fork_idea / bury_idea 等有副作用的工具时，
//   不立即落库，而是返回一个 confirmation token 让前端/用户二次确认。
//
// 流程：
//   1. LLM 调 register_idea（confirm=false） → 工具不执行，返回 token + 摘要给 LLM
//   2. LLM 把"是否确认创建 X" 抛给用户
//   3. 用户回复"确认" → LLM 再次调 register_idea（confirm=<token>） → 真正执行
//
// token 与参数绑定：只有相同参数复用同一个 token 才会执行，避免 LLM 串改。

const (
	confirmTokenTTL     = 5 * time.Minute
	confirmTokenMaxLife = 30 * time.Minute
)

type pendingAction struct {
	toolName  string
	argsJSON  string // 参数指纹（防篡改）
	principal Principal
	createdAt time.Time
}

type ToolConfirmation struct {
	mu      sync.Mutex
	pending map[string]pendingAction
}

func NewToolConfirmation() *ToolConfirmation {
	return &ToolConfirmation{pending: make(map[string]pendingAction)}
}

// IsWriteTool 判断一个工具是否为需要二次确认的写操作。
func IsWriteTool(name string) bool {
	switch name {
	case "register_idea", "fork_idea", "bury_idea", "send_flowers":
		return true
	}
	return false
}

// Create 记录一个待确认的写操作，返回一次性 token。
// argsFingerprint 是去除了 confirm 字段后的参数指纹，用于二次校验防篡改。
func (tc *ToolConfirmation) Create(toolName, argsFingerprint string, p Principal) (string, error) {
	token, err := randomToken(12)
	if err != nil {
		return "", err
	}
	tc.mu.Lock()
	tc.pending[token] = pendingAction{
		toolName:  toolName,
		argsJSON:  argsFingerprint,
		principal: p,
		createdAt: time.Now(),
	}
	tc.mu.Unlock()
	return token, nil
}

// Consume 校验并消费一个 token。校验失败返回 ok=false。
// 校验维度：存在 / 未过期 / 工具名一致 / 参数指纹一致 / Principal 一致。
func (tc *ToolConfirmation) Consume(token, toolName, argsFingerprint string, p Principal) (bool, string) {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	pa, ok := tc.pending[token]
	if !ok {
		return false, "invalid or unknown confirmation token"
	}
	delete(tc.pending, token)

	if time.Since(pa.createdAt) > confirmTokenTTL {
		return false, "confirmation token expired, please retry"
	}
	if pa.toolName != toolName {
		return false, "token was issued for a different tool"
	}
	if pa.argsJSON != argsFingerprint {
		return false, "tool parameters changed, please re-confirm"
	}
	if pa.principal.UserID != p.UserID || pa.principal.AgentID != p.AgentID {
		return false, "confirmation principal mismatch"
	}
	return true, ""
}

// Cleanup 删除过期的 token（confirmTokenMaxLife 之前的）。
// 在每次 Create 时调用一次即可，无需定时器。
func (tc *ToolConfirmation) Cleanup() {
	tc.mu.Lock()
	defer tc.mu.Unlock()
	now := time.Now()
	for k, v := range tc.pending {
		if now.Sub(v.createdAt) > confirmTokenMaxLife {
			delete(tc.pending, k)
		}
	}
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
