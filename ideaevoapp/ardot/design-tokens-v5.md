# 万叶 v5 Design System（已归档）

> ⚠️ **已废弃 — 请使用 [v6](./design-tokens-v6.md)**  
> v6 采用 triply-ai 原生 iOS 风格（扁平 · 卡片 · 清爽），替换了 v5 的浮动 PillTabBar、Bento 实体色和黑色 CTA。  
> 迁移指南见 [v6 §11 变更日志](./design-tokens-v6.md#11-变更日志v5--v6)。

---

# 万叶 v5 Design System

**来源：** Ardot 工具 UI + Bento 功能卡 + Onboarding 参考图  
**原则：** User → Agent → Idea 三角关系 · Idea 一等公民 · Fork 亮点

---

## 参考图 → Token 映射

| 参考图 | 提取元素 | 万叶应用 |
|--------|----------|----------|
| Ardot 侧栏/属性面板 | `#F5F5F5` canvas、白 surface、pill 分段、黑主按钮 | Tab、设置、主 CTA |
| 浮动工具栏 | 白 capsule + 轻阴影、绿色选中态 | Tab Bar、Engagement 选中 |
| Bento 功能卡 | 黄/绿/青 Pastel 底、粗体标题、描边 Pill + → | 实体 Bento、Fork CTA |
| Onboarding 卡 | 大圆角 28、黑 pill「下一步」、灰正文 | 登录/onboarding |
| 图层列表 | 细线分隔、12px 圆角选中态 | 列表、Segmented |

---

## 1. Color

### Neutral
| Token | Hex | 用途 |
|-------|-----|------|
| `canvas` | `#FAFAFA` | App 背景 |
| `surface` | `#FFFFFF` | 卡片、浮层 |
| `fill` | `#F5F5F5` | Segmented 底、输入框 |
| `rule` | `#EBEBEB` | 1px 分隔 |
| `ink` | `#0A0A0A` | 主文字、主 CTA |
| `ink-soft` | `#3D3D3D` | 正文 |
| `ink-faint` | `#8E8E93` | 时间、Overline |
| `ink-disabled` | `#C7C7CC` | 禁用 |

### Entity（Bento 实体色）
| Token | Hex | 实体 |
|-------|-----|------|
| `entity-user` | `#FFF4A8` | User 用户 |
| `entity-agent` | `#D4F56A` | Agent 代理 |
| `entity-idea` | `#B8F5EC` | Idea 想法 |

### Semantic
| Token | Hex | Tint | 用途 |
|-------|-----|------|------|
| `accent-active` | `#3D9970` | `#E8F5EE` | 活跃 Idea、进度条 |
| `accent-fork` | `#FF6B35` | `#FFF0EA` | Fork 衍生 |
| `accent-toolbar` | `#52C41A` | — | 工具栏选中（参考 Ardot 绿） |
| `accent-warning` | `#FFCB47` | `#FFF8E1` | 提示 |

---

## 2. Typography（Inter / PingFang SC）

| Token | Size/LH | Weight | 用途 |
|-------|---------|--------|------|
| `display` | 32/38 | Bold | Bento 营销标题 |
| `title-lg` | 26/32 | Bold | Idea 详情标题 |
| `title-md` | 22/28 | Bold | 个人/Agent 名 |
| `headline` | 18/24 | SemiBold | 区块标题 |
| `body-lg` | 16/26 | Regular | 正文 |
| `body-md` | 14/22 | Regular | 卡片摘要 |
| `caption` | 12/18 | Medium | Agent 名、统计 |
| `overline` | 11/14 | SemiBold | USER · AGENT · IDEA |
| `button` | 15 | SemiBold | 主按钮 |
| `pill` | 14 | SemiBold | Pill CTA + → |

---

## 3. Spacing（8pt Grid · 紧凑版）

| Token | px | 用途 |
|-------|-----|------|
| `space-1` | 4 | Pill 内 gap |
| `space-2` | 8 | 小间距 |
| `space-3` | 10 | 卡片列表 gap |
| `space-4` | 12 | 卡片内 padding（紧凑） |
| `space-5` | 16 | **page-x** 页面左右边距 |
| `space-6` | 16 | **section-gap** 区块间距 |
| `space-8` | 24 | 大区块（少用） |
| `float-overlap` | -28 | Hero float 重叠 |

**宽度对齐（390 屏）：**
- `page-x` = **16** → 内容区 **358px**
- 所有屏幕 Nav / Content / Tab Bar / Segmented 统一 16px 边距
- 卡片、三角组件、Feed 项宽度 = `fill_container`（358px）

---

## 4. Radius & Elevation

| Radius | px | 用途 |
|--------|-----|------|
| `xs` | 8 | 主按钮 |
| `sm` | 12 | Hint、chip |
| `md` | 16 | 卡片、三角 cell |
| `lg` | 20 | Float 身份卡 |
| `bento` | 20 | Fork Bento（紧凑） |
| `pill` | 999 | Tab、CTA |
| `screen` | 40 | 手机框 |

| Elevation | 阴影 | 用途 |
|-----------|------|------|
| E0 | 无 | Bento 实体块 |
| E1 | 0 2px 8px rgba(0,0,0,0.04) | Float 卡 |
| E2 | 0 4px 24px rgba(0,0,0,0.08) | Tab Bar、Engagement |
| E-pill | 0 1px 3px rgba(0,0,0,0.06) | Segmented 选中 |

---

## 5. 核心组件

| 组件 | 说明 |
|------|------|
| `C/RelationshipTriangle` | User(黄) → Agent(绿) → Idea(青) 溯源 |
| `C/EntityBentoCard` | 单实体 Pastel 块 |
| `C/PillSegmented` | Figma/Ardot 式 pill Tab |
| `C/IdeaCard` | 列表卡：Agent 行 + 标题 + 进度 + 互动 |
| `C/ImplementationProgress` | 实现进度条 |
| `C/PillCTA` | 描边 pill + →（Fork / 聊天） |
| `C/EngagementBar` | ♥ ✿ ⑂ 💬 底栏 · 见 §7 |
| `C/BottomInputBar` | 对话 / 评论输入 · 见 §7 |
| `C/TabScreenHeader` | Tab 根页顶栏 · 见 §7 |
| `C/AtlasPushNavBar` | Push 子页顶栏 · 见 §7 |

---

## 7. Bottom Chrome · 底部栏互斥

同一时刻只显示 **一种** 底部 chrome；Push 子页隐藏 `C/PillTabBar`。

| 组件 | 高度 | 场景 | Ardot |
|------|------|------|-------|
| `C/PillTabBar` | 62 | 4 Tab 根页 | `93:1789` |
| `C/EngagementBar` | 72 | Idea 详情 / 鲜花页 | `129:352` |
| `C/BottomInputBar` | 56 | 对话线程 / 评论 | `129:365` |

### `C/EngagementBar`

- 4 等分列：`layoutGrow 1` · 列内垂直居中 · icon 18 + count 11 · gap 2
- 顺序：♥ Like · ✿ Flower · ⑂ Fork · 💬 Comment
- 激活态（Fork / 当前页强调项）：`accent-fork` `#FF6B35`
- 顶描边 `rule` · 上阴影 E2（`y:-2 r:16 @6%`）· padding 16

### `C/BottomInputBar`

- 白底 + 顶描边 `rule` · padding 16/6
- Field：`fill` 底 · h44 · r12 · placeholder `ink-faint`
- Send：40×40 黑圆 · `↑` 白色 14 SemiBold

### `C/TabScreenHeader` · Tab 根

- h44 · 左标题 **22pt Bold** · 右 `C/ToolbarFloat` · trailing gap 8 · **HitTarget 44×44**
- 无返回按钮

### `C/AtlasPushNavBar` · Push 子页

- h44 · 左 `C/ToolbarFloat Icon` ‹ · 居中标题 **17pt SemiBold** · 右 Trailing floats · **HitTarget 44×44**
- `C/ToolbarFloat` 视觉 36×36 可保留 · 热区必须 **44×44**
- 无标题时 Title Slot 留空；单返回场景右侧放 44×44 Spacer 保持标题居中

---

## 8. Marvel Art V4.0 · Mobile Compiler 对齐

> 完整评审：[marvel-art-review-v4.md](./marvel-art-review-v4.md)

### 移动端字阶（新屏优先）

| Token | Size | Weight | Color | 用途 |
|-------|------|--------|-------|------|
| `mobile-large-title` | 34pt | Bold | `#111111` | Onboarding 大标题 |
| `mobile-title` | 22pt | Bold | `#111111` | Tab 根页 / 详情标题 |
| `mobile-body` | **17pt** | Regular | `#222222` | 卡片正文、README、评论 |
| `mobile-subheadline` | 15pt | Regular | `#666666` | slug、创建者、空状态副文 |
| `mobile-caption` | 13pt | Regular | `#999999` | 时间、统计脚注 |

`body-lg` 16pt / `body-md` 14pt 仅作紧凑辅助，**不得**作卡片主阅读字号。

### 触控热区

| Token | 值 |
|-------|-----|
| `touch-target` | **44×44** pt/px |
| `touch-icon-pad` | **10px**（visual 24px 图标外扩） |
| `touch-center-action` | **56×56**（Header `+`） |

### 布局硬规则

- Page **16px** · Card **r16** · Divider **1px `#EBEBEB`**
- Section：**V-Stack** 或 **H-Scroll peek 15%** — 禁止 2D Grid
- **禁止双层嵌套卡片**

### 动效物理

| 交互 | 参数 |
|------|------|
| Swipe back | 底层 **+35%** 水平视差 |
| Sheet open | 背景 **scale 0.95** + **dim 0.4** |
| Long press | **blur 20px** + **scale 1.05** |
| Sheet Handle | **40×4px**, r2 |

---

## 9. 组件 Marvel V4.0 合规索引

> 各组件完整规格见 `screens/` 对应文档 · 评审 [`marvel-art-review-v4.md`](./marvel-art-review-v4.md)

| 组件 | Frame | 布局 | 字阶 | Hit |
|------|-------|------|------|-----|
| `C/TabScreenHeader` | DS | H44 · Title **22pt** | Bold | Trailing **44** · `+` **56** |
| `C/AtlasPushNavBar` | DS | H44 · Title **17pt** | SemiBold | **44** |
| `C/ToolbarFloat` | `109:152` | visual 36 | — | **44** |
| `C/PillTabBar` | `93:1789` | float bottom+12 | 10pt label | **44**/tab |
| `C/IdeaCardHero` | `129:41` | tint band 96h | slug **15** | 整卡 |
| `C/IdeaIdentityHero` | `129:18` |单卡 minH100 | title **22** | — |
| `C/RepoTabs` | Detail | **H-Scroll** peek 15% | **15pt** | **44** |
| `C/EngagementBar` | Detail | H72 | **13pt** stats | **44** |
| `C/BottomInputBar` | Chat/Comments | H56 | input **17pt** | send **44** |
| `C/IdeaSearchCard` | Search | V-Stack row | title **17pt** | row **44** |
| `C/FlowerContributorRow` | Flowers | V-Stack | name **15pt** | **44** |
| `C/RelationshipTriangle` | `93:747` | H-Stack | **15pt** | cell **44** |
| `C/SheetTitleRow` | `134:418` | H44 | Title **17pt** Bold | Close/Check **44** |
| `C/SheetHandle` | `134:297` | **40×4** r2 | `#EBEBEB` | — |
| `C/Dialog` | `134:298` | r20 p20 | Title/Body **17pt** | btn **minH 44** |

**硬规则：** Section 仅 `V-Stack` 或 `H-Scroll` · 禁 `LazyVGrid` · 禁双层嵌套卡 · Sheet **zoom 0.95 dim 0.4**

---

## 6. 屏幕清单（v5 · 完整）

| ID | Frame | 屏幕 |
|----|-------|------|
| DS | `93:713` | Design System |
| S02 | `93:927` | Home 广场/关注 |
| S03 | `93:904` | Chat Thread |
| S03S | `93:1170` | Search Results |
| S04 | `93:759` | Idea Detail |
| S04P | `93:1123` | Publish Idea |
| S04D | `93:1136` | Fork 谱系 |
| S05 | `93:991` | Comments |
| S06 | `93:1013` | Chat List |
| S08 | `93:952` | Activity |
| S08N | `93:972` | Notifications |
| S01 | `93:1035` | Login |
| S01C | `93:1185` | Forgot Password |
| S09 | `93:1049` | Profile 我的 |
| S09B | `93:833` | User Profile |
| S09C | `93:1151` | Follow List |
| S10 | `93:868` | Agent Profile |
| S11 | `93:1074` | Settings |
| S13 | `93:1111` | Agent Explore |
| S14B | `93:1093` | My Agents |
