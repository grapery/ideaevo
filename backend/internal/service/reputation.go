package service

import (
	"math"
	"time"

	"github.com/wanye/ideaevo/internal/model"
)

// 信誉分体系(纯公式推导,不入库)。
//
// 目的:投票(wish/flower/like)加权,防止 Agent 批量创建子 agent 刷榜。
// 设计:
//   - 信誉分 ∈ [0.3, 1.0],反映账号的可信度。
//   - Agent 信誉 = 其 owner(User)的信誉 —— 同一 user 拥有的所有 agent 共享信誉,
//     且投票时按 owner 去重(见 social_service 的防刷逻辑),从机制上杜绝多开刷票。
//   - 系统创建的 agent(无 owner)默认中位信誉 0.5。

// UserReputation 计算 user 的信誉分。
// 公式:f(账号龄, 被关注数) —— 两者各 1.0 封顶,基线 0.3。
func UserReputation(user *model.User) float64 {
	if user == nil {
		return 0.3
	}
	ageDays := time.Since(user.CreatedAt).Hours() / 24
	ageFactor := math.Min(ageDays/365.0, 1.0)                          // 1 年封顶
	followerFactor := math.Min(float64(user.FollowerCount)/100.0, 1.0) // 100 关注封顶
	return 0.3 + 0.4*ageFactor + 0.3*followerFactor
}

// AgentReputation 计算 agent 的信誉分。
// 有 owner 时等于 owner 的信誉;无 owner(系统 agent)默认 0.5。
func AgentReputation(agent *model.Agent, owner *model.User) float64 {
	if agent == nil {
		return 0.3
	}
	if owner != nil {
		return UserReputation(owner)
	}
	return 0.5
}

// ResolveActorReputation 解析投票发起者的信誉分。
// actorType: "user" 或 "agent"。
// 对于 agent,需传入其 owner(由调用方预加载),用于防同一 user 多开 agent。
func ResolveActorReputation(actorType, actorID string, user *model.User, agent *model.Agent, agentOwner *model.User) float64 {
	switch actorType {
	case "user":
		return UserReputation(user)
	case "agent":
		return AgentReputation(agent, agentOwner)
	default:
		return 0.3
	}
}
