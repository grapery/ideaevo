# Idea Identity · 身份展示原则

**适用：** 所有展示 Idea 的 UI（Feed、详情、搜索、动态、Fork 树等）  
**Marvel V4.0：** 与 [`design-tokens-v5.md`](../design-tokens-v5.md) §8 · [`marvel-art-review-v4.md`](../marvel-art-review-v4.md) 对齐

Idea 是带**视觉身份**的仓库对象 — 规格必须用 **Token 声明**，禁止「美观卡片」类描述。

### 📱 原则：Idea Identity | 🎯 任务：任意界面展示 Idea 时字段与字阶一致

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

**`C/IdeaCardHero` / `C/IdeaIdentityHero` 通用结构**
```
┌─ Identity Container R16 ─────────────┐
│ [Tint band @12% gradient]            │
│ Avatar48 | slug 15pt Semibold        │
│ Creator 15pt #666 · time 13pt #999   │
│ ─── Divider #E5E5E5 (optional) ───   │
│ Title 22pt Bold OR body 17pt         │
│ Tags H-Scroll peek 15% OR stats row  │
└──────────────────────────────────────┘
// NO nested card inside
```

#### 2.–6. 见下方字段表与组件索引

#### 2. 元素样式、字阶与 Token 约束

* 见「必展示字段」「字阶」表 — Body **17pt** / Slug **15pt Semibold** / Meta **13pt #999**
* 容器 **r16** · **Divider #E5E5E5** · **禁止** 嵌套身份卡

#### 3. 上下文状态机切换逻辑

* `[Idle · 展示]` → 身份 Hero/Compact 只读
* `[Tap 头像/slug]` → Push Idea Detail · **parallax 35%**
* `[Long press 卡]`（Feed 可选）→ **blur 20px + scale 1.05** + 菜单 r12

#### 4. 物理微动效与手势声明

* Tint 渐变：`dominantColor @ 0.12` → transparent
* Tags/stats：**H-Scroll peek 15%**

#### 5. 双重空状态表现细节

* 身份组件本身无空态 — 宿主屏负责（如无 Idea 列表见各屏 `12-states`）

#### 6. 声明式 UI 架构伪代码

```swift
Card(radius: 16, padding: 16) {
    VStack(spacing: 0) {
        TintBand(opacity: 0.12)
        HStack {
            IdeaAvatar(size: 48)
            VStack(alignment: .leading) {
                Text(slug).font(.system(size: 15, weight: .semibold))
                CreatorLine(font: 15, color: #666)
                TimeLine(font: 13, color: #999)
            }
        }
        Divider().foregroundStyle(#E5E5E5)
        Text(title).font(.system(size: 17, weight: .semibold))
        ScrollView(.horizontal) { statsChips } // peek 15%
    }
}
```

## 必展示字段

| 字段 | 规格 | iOS / 后端 |
|------|------|------------|
| **Idea 头像** | 32 / 48 / 56 · r10–16 | `icon_url` → OSS；无则 DiceBear；可上传 |
| **Slug** | **15pt Semibold #222** | `repo_url` tail 或 title 截断 |
| **创建者** | 头像 18–20 + 姓名 · **15pt #666** | `owner` / `actor` |
| **Agent** | 名 · **15pt #666** | `agent` |
| **创建时间** | **13pt #999** `创建于 M月d日` | `created_at` |
| **更新时间** | **13pt #999** `更新 feedTimestamp` | `updated_at` |
| **统计** | mini：icon 13 + count 11 | fork/flower/like/comment |
| **状态 / Tags** | Chip **13pt** · r12 Capsule | `status` · `tags` |

## 字阶（身份组件内）

| 层级 | Token | 用于 |
|------|-------|------|
| 页面标题 | `mobile-title` 22pt Bold | 详情标题（Hero 外） |
| 卡片标题 | **17pt Semibold** | Compact 卡中文标题 |
| 正文 | `mobile-body` 17pt | README、描述行 |
| Slug | **15pt Semibold** | Hero / ContextBar |
| Meta | **13pt #999** | 时间、统计脚注 |

## 背景 Tint

```
tint = dominantColor(creatorAvatar) @ 0.12 → gradient to transparent
```

- 有 `icon_url` 可用 Idea 头像主色
- 无头像：DiceBear seed 色 fallback

## 布局硬规则（身份容器）

- **禁止** 身份 Hero 内再嵌完整子卡片 — 用 **Divider 1px #EBEBEB**
- Tags / mini stats：**H-Scroll 单行** peek 15%，或单行 HStack
- **禁止** 送花者/贡献者 **2D Grid** — 用 H-Scroll 或 V-Stack 行

## 组件索引

| 组件 | 尺寸 | Frame | 流向 |
|------|------|-------|------|
| `C/IdeaAvatar` | 32·48·56 | `129:62`+ | — |
| `C/IdeaCardHero` | Feed 96h | `129:41` | tint band |
| `C/IdeaIdentityHero` | Detail minH100 | `129:18` | 单卡 |
| `C/IdeaSearchCard` | 搜索行 | `129:86` | V-Stack 列表项 |
| `C/ActivityRepoEvent` | 动态行 | `93:957` | V-Stack + Divider |
| `C/BranchNode` | Fork 树 | `93:1145` | **V-Stack** 树（非 Grid） |
| `C/IdeaContextBar` | 上下文 | `129:155` | 单卡 r16 |
| `C/IdeaCardCompact` | 紧凑列表 | `93:865` | V-Stack 列表 |
| `C/IdeaChatCard` | Chat 内 | `93:921` | 单卡，消息流内 |
| `C/FlowerContributorRow` | 送花行 | `129:287` | V-Stack 列表 |
| `C/IdeaForkSource` | Fork Sheet | `93:1212` | Sheet 内容单卡 |

## 禁止

- 仅 slug/标题一行，无头像、创建者、时间
- Feed 无 mini stats
- 所有 Idea 同一灰色底（必须 tint 差异化）
- 双层嵌套身份卡
