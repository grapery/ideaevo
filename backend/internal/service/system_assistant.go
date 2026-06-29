package service

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// SystemAssistantName 是内置万叶助手的固定名字（启动时按这个名字查找/创建）。
const SystemAssistantName = "万叶助手"

// SystemAssistantDescription 是内置助手的人设描述。
// 这个描述会进入 system prompt，决定助手如何与用户对话。
const SystemAssistantDescription = `你是「万叶助手」，万叶想法市场的内置 AI 助手。

你的职责：
- 帮用户发现有意思、相关、已经做出来或正在做的 idea
- 帮用户把自己的想法注册到平台上（生成结构化标题/描述/分类）
- 帮用户点赞、送花、致敬（fork）、评论感兴趣的 idea
- 与用户讨论、评估、对比 idea

工作方式：
- 当用户要创建或完善 idea 时：先参考系统自动检索到的相关 idea（或调用 search_ideas(scope=mine)），对比全站相似想法，再帮用户起草标题/描述/分类
- 当用户的请求涉及具体操作时，主动调用相应工具（search_ideas/register_idea/like_idea/fork_idea 等）
- 调用工具后，用自然语言解释结果，例如"我为你找到了 3 个相关想法：..."
- 当用户请求含糊时，先简短澄清再行动
- 涉及创建/点赞/送花等写操作时，确认用户意图后再执行
- 中文回复为主，但用户用英文时跟随用户语言

创建 idea 推荐流程：
1. 检索用户已有 idea（search_ideas scope=mine）与全站相似 idea
2. 说明差异化，避免与已有 idea 重复
3. 与用户确认草稿后调用 register_idea（需二次确认 token）

边界：
- 不要编造 idea 数据，所有 idea 必须来自 search/query 工具的结果
- 不要代替用户做价值判断（如"这个想法一定火"），可以分析利弊
- 不暴露工具的原始 JSON，用人类可读的方式总结`

// SystemCapabilities 是内置助手声称拥有的能力。
var SystemCapabilities = []string{
	"search_ideas",
	"query_ideas",
	"get_idea_detail",
	"register_idea",
	"fork_idea",
	"like_idea",
	"bury_idea",
	"send_flowers",
	"create_comment",
	"get_comments",
}

// EnsureSystemAssistant 确保「万叶助手」agent 存在。
// 如果 SYSTEM_AGENT_ID 配置了：按 ID 查找，找不到则按 ID 创建。
// 如果未配置：按固定名字查找，找到就用它的 ID；找不到则创建一个。
// 返回该 agent 的 ID（供 main.go 用于过滤工具白名单等场景）。
func EnsureSystemAssistant(db *gorm.DB, configuredID string) (string, error) {
	// 1. 显式配置优先
	if configuredID != "" {
		var agent model.Agent
		err := db.First(&agent, "id = ?", configuredID).Error
		if err == nil {
			return agent.ID, nil
		}
		if err != gorm.ErrRecordNotFound {
			return "", fmt.Errorf("query system agent: %w", err)
		}
		// 按 ID 创建
		return createSystemAgent(db, configuredID)
	}

	// 2. 按名字查找
	var agent model.Agent
	err := db.First(&agent, "name = ?", SystemAssistantName).Error
	if err == nil {
		return agent.ID, nil
	}
	if err != gorm.ErrRecordNotFound {
		return "", fmt.Errorf("query system agent by name: %w", err)
	}

	// 3. 不存在则创建
	return createSystemAgent(db, "")
}

func createSystemAgent(db *gorm.DB, fixedID string) (string, error) {
	capJSON, _ := json.Marshal(SystemCapabilities)

	// 内置 agent 不需要 api_key（用户通过 JWT 直接与它对话），
	// 但 APIKeyHash 字段有 unique 约束且 not null，给个固定占位值。
	agent := &model.Agent{
		Name:         SystemAssistantName,
		Description:  SystemAssistantDescription,
		APIKeyHash:   "system-assistant-no-api-key",
		Capabilities: string(capJSON),
	}
	if fixedID != "" {
		agent.ID = fixedID
	}

	if err := db.Create(agent).Error; err != nil {
		return "", fmt.Errorf("create system assistant: %w", err)
	}

	log.Printf("[bootstrap] created system assistant: id=%s name=%s", agent.ID, agent.Name)
	return agent.ID, nil
}

// IsSystemAgent 判断给定 agent 是否为内置助手。
func IsSystemAgent(db *gorm.DB, agentID string) bool {
	if agentID == "" {
		return false
	}
	var count int64
	db.Model(&model.Agent{}).Where("id = ? AND name = ?", agentID, SystemAssistantName).Count(&count)
	return count > 0
}
