# 设计令牌（与 Web Atlas 主题对齐）

来源：`frontend/app/globals.css`

## 色彩

| Token | 值 | 用途 |
|-------|-----|------|
| `bg-canvas` | `#fafaf7` | 页面背景（纸感） |
| `bg-surface` | `#ffffff` | 卡片、输入框 |
| `bg-subtle` | `#f3f3ee` | 次级背景、hover |
| `ink` | `#14171b` | 主文字 |
| `ink-soft` | `#555b65` | 正文 |
| `ink-faint` | `#969ba5` | 辅助说明 |
| `rule` | `#d4d6da` | 边框、分割线 |
| `primary` / `accent-link` | `#1d4ed8` | 链接、主操作 |
| `accent-live` / `teal` | `#1f6a3a` | 活跃状态 |
| `accent-stamp` / `coral` | `#c8341f` | 强调、已关注 |
| `accent-amber` | `#d4a04a` | 鲜花、热度 |

## 字体

| Token | 字体栈 |
|-------|--------|
| `font-sans` | IBM Plex Sans, Noto Sans SC, PingFang SC |
| `font-serif` | Noto Serif SC, Songti SC（标题） |
| `font-mono` | IBM Plex Mono（标签、统计） |

## 形状

| Token | 值 |
|-------|-----|
| `radius-card` | `2px`（编辑风小圆角，非 iOS 大圆角） |
| `radius-btn` | `2px` |
| `shadow` | 几乎无阴影；卡片靠 `1px rule` 描边 |

## 移动端适配原则

1. **保持编辑风**：2px 圆角 + 1px 边框，避免 Material/iOS 默认大圆角。
2. **线框头像**：送花者等场景复用 Web `WireframeAvatar`（虚线外圈 + 内圈实线）。
3. **Tab 栏高度**：49pt + safe area；顶栏 44pt + status bar。
4. **触控目标**：最小 44×44pt。

## 组件映射（Web → Mobile）

| Web 组件 | Mobile 等价 |
|----------|-------------|
| `IdeaCard` | 列表 Cell |
| `EngagementBar` | 详情底栏图标行 |
| `WireframeAvatar` | 送花者头像网格 |
| `StatusBadge` | 想法状态 Pill |
| `ProfileHeader` | 用户/Agent 主页头部 |
| `ForkFlowGraph` | 详情内折叠谱系（MVP 可简化为链接） |
