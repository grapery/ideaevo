# 万叶 v4 Design System

> **Legacy：** 新屏与移动端实现以 [design-tokens-v5.md](./design-tokens-v5.md) + [Marvel Art V4.0 评审](./marvel-art-review-v4.md) 为准。本文档保留 v4 历史对照。

**Ardot:** `93:615` Design System v4 Spec · `93:347` C/RelationshipTriangle  
**File ID:** `698461866257245`

---

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| **三角关系优先** | User → Agent → Idea 首屏可见 |
| **8pt 间距网格** | 所有 spacing 为 4 的倍数 |
| **实体色编码** | User 黄 / Agent 绿 / Idea 青 |
| **层级清晰** | Display → Title → Headline → Body → Caption → Overline |
| **工具感 + 亲和力** | 黑 CTA + Pastel Bento + Pill 控件 |

---

## 2. Typography（Inter / PingFang SC）

| Token | Size | Line | Weight | 用途 |
|-------|------|------|--------|------|
| `type-display` | 32 | 38 | Bold | Bento 大标题 |
| `type-title-lg` | 26 | 32 | Bold | Idea 详情标题 |
| `type-title-md` | 22 | 28 | Bold | 个人/Agent 昵称 |
| `type-headline` | 18 | 24 | SemiBold | 区块标题、Fork CTA |
| `type-body-lg` | 16 | 26 | Regular | 正文描述 |
| `type-body-md` | 14 | 22 | Regular | 卡片摘要、bio |
| `type-caption` | 12 | 18 | Medium | Agent 名、时间、统计标签 |
| `type-overline` | 11 | 14 | Medium | USER · AGENT · IDEA 标签 |
| `type-button` | 15 | — | SemiBold | 主按钮 |
| `type-pill` | 14 | — | SemiBold | Pill CTA |
| `type-tab` | 14 | — | SemiBold/Medium | Segmented Tab |

**字距：** Display/Title `-0.02em`  
**数字：** 统计、进度使用 tabular-nums

---

## 3. Spacing（8pt Grid）

| Token | px | 用途 |
|-------|-----|------|
| `space-1` | 4 | 紧凑 gap、Pill 内 padding |
| `space-2` | 8 | 小元素间距 |
| `space-3` | 12 | 卡片内子项、三角组件 gap |
| `space-4` | 16 | 卡片内 padding、进度条 padding |
| `space-5` | 20 | **page-x** 页面左右边距 |
| `space-6` | 24 | **section** 区块间距 |
| `space-8` | 32 | 大区块分隔 |
| `space-10` | 40 | Hero 上下 |
| `space-12` | 48 | 页面 bottom padding |

**布局常量：**
- `page-x`: 20
- `section-gap`: 24
- `card-inner`: 16–20
- `float-overlap`: -36

---

## 4. Color

### 4.1 Neutral

| Token | Hex | 用途 |
|-------|-----|------|
| `canvas` | `#FAFAFA` | 页面背景 |
| `surface` | `#FFFFFF` | 卡片、浮层 |
| `fill` | `#F5F5F5` | Segmented 底、输入框 |
| `rule` | `#EBEBEB` | 1px 分隔、进度条底 |
| `ink` | `#0A0A0A` | 主文字、主 CTA |
| `ink-soft` | `#3D3D3D` | 正文 |
| `ink-muted` | `#6B7280` | 次要信息 |
| `ink-faint` | `#8E8E93` | 时间戳、Overline |
| `ink-disabled` | `#C7C7CC` | 禁用态 |

### 4.2 Entity（Bento）

| Token | Hex | 实体 |
|-------|-----|------|
| `entity-user` | `#FFF4A8` | User |
| `entity-agent` | `#D4F56A` | Agent |
| `entity-idea` | `#B8F5EC` | Idea |

### 4.3 Semantic

| Token | Hex | 背景 Tint | 用途 |
|-------|-----|-----------|------|
| `status-active` | `#3D9970` | `#E8F5EE` | Idea 活跃 |
| `status-fork` | `#FF6B35` | `#FFF0EA` | Fork 衍生 |
| `status-warning` | `#FFCB47` | `#FFF8E1` | 提示 |
| `status-buried` | `#8E8E93` | `#F5F5F5` | 已埋葬 |
| `status-error` | `#FF6B35` | `#FFF0EA` | 错误 |

---

## 5. Radius

| Token | px | 用途 |
|-------|-----|------|
| `radius-xs` | 8 | 主按钮、小 chip |
| `radius-sm` | 12 | Hint 条、Fork 行 |
| `radius-md` | 16 | 卡片、进度条、三角 cell |
| `radius-lg` | 20 | Float Identity Card |
| `radius-bento` | 28 | Fork Bento、大区块 |
| `radius-pill` | 999 | Tab、Pill CTA、Status |
| `radius-screen` | 40 | 手机框 |

---

## 6. Elevation

| Level | 样式 | 用途 |
|-------|------|------|
| **E0** | 无阴影，Pastel 底色或 1px 描边 | Bento、Fork 区 |
| **E1** | `0 2px 8px -2px rgba(0,0,0,0.04)` + `0 8px 24px -4px rgba(0,0,0,0.02)` | Float 身份卡 |
| **E2** | `0 4px 24px -4px rgba(0,0,0,0.08)` | Engagement Bar、Tab Bar |
| **E-pill-active** | `0 1px 3px rgba(0,0,0,0.06)` | Segmented 选中 Tab |

---

## 7. Components

| 组件 | Ardot ID | 规格 |
|------|----------|------|
| RelationshipTriangle | `93:347` | 350×96, r24, cell r16, Overline 11 + Name 13 |
| Button Primary v4 | DS Spec | h44, r8, ink bg, 15/SB white |
| Button Pill v4 | DS Spec | h36, r999, 1px ink stroke, 14/SB |
| Pill Segmented | User v4 | fill #F5F5F5, active white + E-pill-active |
| ImplementationProgress | Idea v4 | r16, padding 12, bar h6 |

---

## 8. 页面 Token 应用

| 屏幕 | ID | 关键 Token |
|------|-----|------------|
| Idea Detail v4 | `93:363` | section 24, title-lg 26, triangle, progress, fork bento r28 |
| User Profile v4 | `93:439` | entity-user banner, title-md 22, pill tab, hint r12 |
| Agent Profile v4 | `93:486` | entity-agent banner, owner row, privacy caption 11 |

---

## 9. iOS / Web 映射（待实现）

```swift
// 建议 AtlasColors v4 扩展
static let entityUser = Color(hex: "#FFF4A8")
static let entityAgent = Color(hex: "#D4F56A")
static let entityIdea = Color(hex: "#B8F5EC")
static let ink = Color(hex: "#0A0A0A")
static let canvas = Color(hex: "#FAFAFA")
```

```css
/* Web CSS variables */
--entity-user: #FFF4A8;
--entity-agent: #D4F56A;
--entity-idea: #B8F5EC;
--space-page-x: 20px;
--space-section: 24px;
```
