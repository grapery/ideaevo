# 全局 Tab Bar · NativeTabBar（v6）

> **版本：** v6 · triply-ai 原生 iOS 风格  
> **历史版本：** v5 PillTabBar（已废弃）  
> **Token 文档：** [design-tokens-v6.md §8](../design-tokens-v6.md#8-nativetabbar--原生-ios-tab-barv6-核心)

---

## 组件：NativeTabBar

**Ardot:** 各 Tab 根页内嵌 FRAME（非 component instance）  
**iOS:** `MainTabView` + 原生 `TabView` `.tabItem`  
**核心任务：** 在 4 个 Tab 根页间切换

### 📱 画布级可视化蓝图

```
┌──────────────────────────────────────┐
│           (Tab 根页内容)              │
│           paddingBottom: 120         │
├──────────────────────────────────────┤ 1px border #E7EAF0
│ [探索]    [对话]    [动态]    [我的]  │ ← H49 bar
│ house    sparkles  bell      person  │   icon 26 + label 10pt
│  蓝       灰        灰        灰     │   SPACE_EVENLY
│                                      │ ← H34 safe area
└──────────────────────────────────────┘
```

> **关键变化（v5→v6）：** 从浮动 pill（距底12px, 圆角36, 毛玻璃）改为 **edge-to-edge 原生 iOS 标准**。激活态从黑色 pill 填充改为 **蓝色 tint**（图标 `.fill` 变体）。

---

### 元素样式与 Token

| Token | 值 |
|-------|-----|
| **容器** | 393×83（49 bar + 34 safe area）· edge-to-edge |
| **背景** | 白色 95% opacity |
| **顶部分隔** | 1px `#E7EAF0` |
| **布局** | HORIZONTAL · SPACE_EVENLY · 4 等分 |
| **Tab 宽度** | 98.25px |
| **Tab 高度** | 49px（bar 区） |
| **图标** | SF Symbol 风格 · 26×26px |
| **标签** | 10pt Medium |
| **激活色** | `#2F6BE4` primary blue |
| **非激活色** | `#8A94A6` text-secondary gray |
| **Tab 内间距** | gap 4px（图标↔标签） |

---

### Tab 项定义

| # | 标签 | 图标（激活） | 图标（非激活） | 根页面 |
|---|------|-------------|---------------|--------|
| 1 | 探索 | `house.fill` `#2F6BE4` | `house` `#8A94A6` | S02 Home |
| 2 | 对话 | `sparkles` `#2F6BE4` | `sparkles` `#8A94A6` | S06 Chat List |
| 3 | 动态 | `bell.fill` `#2F6BE4` | `bell` `#8A94A6` | S08 Activity |
| 4 | 我的 | `person.fill` `#2F6BE4` | `person` `#8A94A6` | S09 Profile |

---

### 一致性规则

1. **4 个 Tab 根页必须全部显示 NativeTabBar**，结构完全一致
2. 每个根页仅 **激活的 Tab 不同**，其余 Tab 结构完全相同
3. Tab Bar 使用 **真实 FRAME 构建**（非 component instance），确保各页独立可控且不会因组件删除而断链
4. **Push 子页隐藏 Tab Bar**（无覆盖、无残留）

---

### 各页激活态

| 页面 | 激活 Tab | Ardot Frame |
|------|---------|-------------|
| S02 Home | Tab 1 (探索) | `149:272` |
| S06 Chat List | Tab 2 (对话) | `149:351` |
| S08 Activity | Tab 3 (动态) | `149:699` |
| S09 Profile | Tab 4 (我的) | `149:414` |

---

### 上下文状态机

| 状态 | Tab Bar | 说明 |
|------|---------|------|
| **Idle · Tab 根页** | **显示** | 首页 / 对话 / 动态 / 我的 |
| **Push 子页** | **隐藏** | 详情 / 设置 / 搜索 / 评论等 |
| **Sheet 打开** | **隐藏** | 背景 scale 0.95 + dim 0.4 |
| **Editing · 输入** | **隐藏** | 仅显示 BottomInputBar |

```
已登录 → 4 Tab 全部可用
未登录 → Tab Bar 仍显示
        · 首页 / 动态：可浏览
        · 对话 / 我的：LoginView 或 Auth Sheet
```

---

### 声明式 UI 架构（伪代码）

```swift
// 原生 iOS Tab Bar — v6
TabView(selection: $tab) {
    HomeView()
        .tabItem { Label("探索", systemImage: "house.fill") }
        .tag(Tab.home)
    ChatListView()
        .tabItem { Label("对话", systemImage: "sparkles") }
        .tag(Tab.chat)
    ActivityScreen()
        .tabItem { Label("动态", systemImage: "bell.fill") }
        .tag(Tab.activity)
    ProfileView()
        .tabItem { Label("我的", systemImage: "person.fill") }
        .tag(Tab.profile)
}
.tint(Color(hex: "#2F6BE4"))  // 激活色
```

> 与 v5 的自定义 `PillTabBar` ZStack 覆盖方案不同，v6 推荐使用 **原生 `TabView`**，iOS 自动处理 safe area、Liquid Glass 效果和切换动画。

---

### App Store 相关

- **5.1.1(v)** 未登录可浏览核心内容（首页 Idea 流、动态）
- **4.8** 提供 Sign in with Apple（见 `S01 Login` OAuth 行）

---

### v5 → v6 迁移对照

| 维度 | v5 PillTabBar | v6 NativeTabBar |
|------|---------------|-----------------|
| 容器 | 浮动 pill（距底12px） | edge-to-edge 标准 |
| 高度 | 62px | 83px（49 + 34 safe） |
| 圆角 | 36px（pill） | 0px（方形） |
| 背景 | 白色 82% + 毛玻璃 | 白色 95% |
| 阴影 | E2（`0 4px 24px rgba(0,0,0,0.08)`） | 无阴影（1px 顶部线分隔） |
| 激活态 | 黑色 `#0A0A0A` pill 填充 + 白字 | 蓝色 `#2F6BE4` tint（无填充背景） |
| 图标 | 自定义 SVG 18px | SF Symbol 26px |
| 实现 | ZStack 覆盖 + safeAreaInset | 原生 TabView `.tabItem` |
