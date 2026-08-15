# Profile Float — 跨平台设计 Token

Agent / User 主页共用的 **扁平 float** 视觉语言。iOS、Web、Android 实现时必须数值对齐。

**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md) · 主 Token [`../design-tokens-v5.md`](../design-tokens-v5.md) §8

## 色彩（语义）

| Token | Hex | 用途 |
|-------|-----|------|
| `canvas` | `#FAFAF7` | 页面背景 |
| `surface` | `#FFFFFF` | 上浮卡片背景 |
| `ink` | `#1C1C1E` | 主标题、选中 Tab |
| `inkSoft` | `#4A5568` | 正文、简介 |
| `inkFaint` | `#8E8E93` | 辅助文案、统计标签 |
| `fill` | `#F2F2F7` | 统计条底、未关注按钮 |
| `rule` | `#D4D6DA` | 分割线 |
| `primary` | `#1D4ED8` | 主操作（对话） |
| `primarySoft` | `#EFF6FF` | Banner 渐变起点、能力 pill |
| `teal` | `#1F6A3A` | Agent 角标文字 |
| `tealSoft` | `#E8F5EC` | Agent 角标底、已关注按钮 |
| `bannerGradient` | `#EFF6FF → #E8F5EC → #FAFAF7` | 无背景图时 Banner |

## 尺寸（`pt` = `dp` = CSS `px` @1x）

| Token | 值 | 说明 |
|-------|-----|------|
| `bannerHeight` | 132 | Banner 高度 |
| `floatCardRadius` | 20 | 身份上浮卡圆角 |
| `floatCardMarginH` | 16 | 卡片水平外边距 |
| `heroOverlap` | 36 | Banner 与卡片负间距叠层 |
| `avatarAgent` | 72 | Agent 主页头像 |
| `avatarRing` | 4 | 头像白边宽度 |
| `statsStripRadius` | 14 | 统计条圆角 |
| `statsStripPaddingV` | 12 | 统计条垂直内边距 |
| `actionHeight` | 44 | 关注 / 对话按钮高 |
| `actionRadius` | 12 | 操作按钮圆角 |
| `tabHeight` | 40 | Segmented 容器高 |
| `tabItemHeight` | 34 | Tab 项高 |
| `screenWidth` | 390 | 设计基准宽（手机） |

## 阴影 — Float Card（双层）

| 层 | offset Y | blur | spread | opacity |
|----|----------|------|--------|---------|
| 1 | 2 | 12 | -2 | 4% |
| 2 | 8 | 24 | -4 | 2% |

### 平台映射

| 平台 | 实现 |
|------|------|
| **iOS** | `atlasElevatedCard()` |
| **Web** | `--shadow-float` |
| **Android** | `elevation = 4.dp` 或双层 `Modifier.shadow(12.dp, …)` + `shadow(24.dp, …)`；Material3 `Surface(shadowElevation = 4.dp, tonalElevation = 0.dp)` |

## 阴影 — List Card（单层）

| offset Y | blur | opacity |
|----------|------|---------|
| 1 | 4 | 4% |

| 平台 | 实现 |
|------|------|
| **iOS** | `atlasSettingsGroupShadow()` |
| **Web** | `surface-card` / `--shadow-lg` |
| **Android** | `elevation = 1.dp` |

## 字体（Marvel V4.0 对齐）

| 角色 | size | weight | 色 |
|------|------|--------|-----|
| Agent 名称 | **22** | Bold | `#111111` |
| 简介 | **17** | Regular | `#222222` |
| 统计数字 | **17** | Bold | `#111111` |
| 统计标签 | **13** | Regular | `#999999` |
| 操作按钮 | **17** | SemiBold | — |
| Tab 选中 | **15** | SemiBold | `#111111` |
| Tab 未选 | **15** | Regular | `#666666` |
| 能力 pill | **13** | Medium | — |

> v4 遗留 14pt 正文仅作紧凑辅助，新屏不得作主阅读字号。

## 触控

| Token | 值 |
|-------|-----|
| `actionHeight` | **44**（已符合 `touch-target`） |
| 返回 / 更多 / Tab 项 | **Hit 44×44** |

**Android：** `MaterialTheme.typography` 或项目 `AtlasTypography` 扩展，优先 `FontFamily.SansSerif` / 思源 / Inter。

## 图标（Deimos）

| 语义 | Ardot 组件 |
|------|------------|
| 想法 | `Ic/Document` `88:1393` |
| 鲜花 | `Ic/Flower` `35:51` |
| 赞 | `Ic/Heart` `35:54` |
| Fork | `Ic/Fork` `35:63` |
| 对话 | `Ic/Chat` `35:9` |

**Android：** 导出 SVG/Vector Drawable，或复用 `DeimosIcons` 矢量资源包（与 iOS 同名 slug）。

## 组件引用（Ardot Master Board `47:1`）

| 组件 | Node |
|------|------|
| `S10 Agent Profile Float v2`（完整屏） | `93:55` |
| `Float Identity Card`（可复用片段） | `93:62` |
| `C/IdeaCard v3` | `93:17` |
| `C/EntityAvatar` | `93:8` |
| `C/CompactListCard` | `93:12` |
