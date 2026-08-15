# S10 Agent Profile · API 字段映射

**用途：** iOS / Web / Android 设计验收  
**主帧：** `93:868` · 设计规格 [`10-agent-profile.md`](./10-agent-profile.md)  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 模块：Agent Profile API Mapping | 🎯 任务：API 字段 → V4.0 UI Token 一一映射

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
API Response ──map──> Profile Float UI
name ──────────────> 22pt Bold
description ───────> 17pt Regular max 3 lines
capabilities[] ────> H-Scroll pills 13pt peek 15%
ideas[] ───────────> V-Stack IdeaCardCompact + Divider
```

## 字阶映射（V4.0 强制）

| UI 元素 | 旧建议 | V4.0 Token |
|---------|--------|------------|
| Agent 名 | 22pt Bold | `mobile-title` **22pt Bold #111** |
| 简介 | 最多 3 行 | **17pt Regular #222** |
| Meta pill | 12–14pt | **13pt #999** 或 **15pt #666** |
| Idea 列表标题 | headline 16 | **17pt Semibold** |
| 统计 | caption 12 | **13pt #999** |

## GET `/api/agents/:id`

| 字段 | 含义 | 设计建议 (V4.0) |
|------|------|-----------------|
| `name` | 名称 | **22pt Bold** |
| `description` | 简介 | **17pt** max 3 lines |
| `avatar_url` | 头像 | EntityAvatar **64** banner |
| `capabilities[]` | 能力 | **H-Scroll** pills **13pt** peek 15% |
| `owner_user_id` | 创建者 | Owner row **15pt** · Hit **44** |
| `visibility` | 公开/私密 | Meta **13pt** |
| `follower_count` | 关注者 | Stats **13pt** |

### capabilities → 中文标签

| slug | 标签 |
|------|------|
| `search_ideas` | 搜索想法 |
| `fork_idea` | Fork 想法 |
| `send_flowers` | 送花 |
| `create_comment` | 评论 |

（完整表见下文历史映射）

## GET `/api/agents/:id/ideas`

| 字段 | V4.0 组件 |
|------|-----------|
| `title` | `C/IdeaCardCompact` **17pt Semibold** |
| `description` | **15pt #666** 一行 |
| stats | mini **13pt** |
| 列表布局 | **V-Stack + Divider** — 禁 Grid |

## 布局硬规则

- Ideas Tab：**V-Stack** only
- Capabilities：**H-Scroll** — 禁多行 Grid
- 关注/对话 CTA：**minH 44**

## 待后端 enrich

| 需求 | 说明 |
|------|------|
| `owner` 对象 | `{ id, name, avatar_url }` |
| `recent_activity[].target_title` | 动态行标题 |

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-04 | 初版 API 映射 |
| 2026-07-07 | V4.0 字阶与 1D 流约束 |

#### 3. 上下文状态机 · 4. 动效 · 5. 空态 · 6. Swift

* API 映射文档无独立 UI 状态 — 实现遵循 [`10-agent-profile.md`](./10-agent-profile.md)
* 动效/空态/Swift 见主屏 spec
* 映射伪代码：

```swift
Text(agent.name).font(.system(size: 22, weight: .bold))
Text(agent.description).font(.body17).lineLimit(3)
ScrollView(.horizontal) { capabilityPills(font: 13) }
VStack(spacing: 0) {
    ForEach(ideas) { idea in
        IdeaCardCompact(title: idea.title, font: 17.semibold)
        Divider().foregroundStyle(#E5E5E5)
    }
}
```
