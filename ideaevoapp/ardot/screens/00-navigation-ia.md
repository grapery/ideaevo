# 全局导航 IA · 触发展示 & 返回（v6）

> **版本：** v6 · triply-ai 原生 iOS 风格  
> **历史版本：** v5（已废弃，见 git 历史）  
> **Token 文档：** [design-tokens-v6.md §7](../design-tokens-v6.md#7-navigation--导航架构v6-重构)

**Ardot:** 各页内嵌 FRAME（非旧版 component instance）  
**iOS:** `MainTabView` + 原生 `TabView` + `NavigationStack`

### 📱 模块：Navigation IA | 🎯 任务：统一导航模式、底栏互斥与 Tab 可见性

#### 1. 画布级可视化蓝图（v6）

```
Tab 根页（大标题模式）:
[无 Top Toolbar]
[大标题 36pt ExtraBold + 右侧操作按钮 40px circle]
[Content cards/lists... paddingBottom: 120]
[NativeTabBar H83 edge-to-edge]

Push 子页（返回导航栏）:
[BackNavBar H48: ‹ 36px circle + 标题 20pt Bold 居中]
[Content... paddingBottom: 40]
[无 Tab Bar]
+ ONE OF:
  · EngagementBar H56 pill（Idea 详情）
  · BottomInputBar H82（对话/评论）
  · (none)

封面页（透明浮层）:
[CoverImage 280h]
[‹ 44px white circle + 操作 44px white circle（浮于封面）]
[Content... ]
```

---

## 导航模式（v6）

### 模式 A · Tab 根页 — 大标题模式

| 元素 | 规格 |
|------|------|
| **Top Toolbar** | **无** — 大标题内嵌于内容顶部 |
| **标题** | 36pt ExtraBold `#0F1B2D` · tracking-tight · paddingTop: safeArea + 8 |
| **副标题** | 15pt Medium `#8A94A6`（可选，标题上方） |
| **右侧操作** | 40×40 圆形 · bg `#F1F3F7` · 图标 20pt `#0F1B2D`（铃铛 / 设置 / 新建） |
| **水平 padding** | 24px（screen-x） |
| **Tab Bar** | NativeTabBar H83 edge-to-edge |

### 模式 B · Push 子页 — 返回导航栏

| 元素 | 规格 |
|------|------|
| **Nav Bar** | H48 · 白色 / 浅灰底 |
| **返回按钮** | 36×36 圆形 · bg `#F1F3F7` · chevron-left 17pt `#0F1B2D` |
| **标题** | 20pt Bold `#0F1B2D` · 居中 |
| **右侧操作** | 可选（保存 / 更多） |
| **水平 padding** | 20px（detail-x） |
| **Tab Bar** | **隐藏** |

### 模式 C · 封面页 — 透明浮层

| 元素 | 规格 |
|------|------|
| **封面图** | 280px 高 · stock/AI 图片 |
| **返回按钮** | 44×44 白色圆形 · chevron-left 18pt `#0F1B2D` · 浮于封面左上 |
| **右侧操作** | 44×44 白色圆形 · fork / share · 浮于封面右上 |
| **标题** | 28pt ExtraBold 白色 · 叠加于封面 scrim 上 |
| **Tab Bar** | **隐藏** |

### 模式 D · Sheet — 关闭/取消

| 元素 | 规格 |
|------|------|
| **背景** | scale 0.95 + dim 0.4 |
| **关闭** | Grabber（40×4 r2 `#E7EAF0`）或 X 按钮 |

---

## 操作按钮规格（v6）

| 类型 | 视觉尺寸 | 底色 | 用途 |
|------|----------|------|------|
| **返回按钮（子页）** | 36×36 圆 | `#F1F3F7` | Push 子页左上 |
| **操作按钮（根页）** | 40×40 圆 | `#F1F3F7` | Tab 根页右上（铃铛/设置） |
| **封面返回/操作** | 44×44 圆 | `#FFFFFF` 白 | 封面页浮层 |
| **发送 FAB** | 52×52 圆 | `#4388E7` | 聊天发送 |
| **主按钮** | 全宽×56 pill | `#3E7BF0` | 登录/生成/保存 |

---

### 禁止（Anti-patterns）

- ❌ Push 子页仍显示 Tab Bar
- ❌ Tab 根页使用 Push 导航栏（返回按钮）
- ❌ Tab 根页无大标题（必须有 36pt ExtraBold 内嵌标题）
- ❌ 自定义浮动 Tab Bar 覆盖（使用原生 TabView）
- ❌ 子页无返回按钮（Sheet 明确关闭除外）

---

## Tab Bar 可见性

| 状态 | 规则 |
|------|------|
| **显示** | 4 个 Tab 根页：首页 / 对话 / 动态 / 我的 |
| **隐藏** | 所有 `navigationDestination` Push 子页 |
| **实现** | 原生 `TabView` 自动管理；Push 使用 `NavigationStack` |

---

## Bottom Chrome · 底部栏互斥（v6）

| 组件 | 高度 | 场景 |
|------|------|------|
| `NativeTabBar` | 83 | Tab 根页（首页 / 对话 / 动态 / 我的） |
| `EngagementBar` | 56 | Idea 详情 — pill · like/flower/fork/comment |
| `BottomInputBar` | 82 | 对话线程、评论页 — 输入 pill + 发送 FAB |

- Push 子页 **只显示一种** 底栏（Engagement 或 Input），**禁止** 与 Tab Bar 叠放
- Tab 根页使用 **大标题模式**（无 toolbar）
- Push 子页使用 **返回导航栏**（‹ + 居中标题）

---

## 上下文状态机（v6）

| 状态 | 触发 | 顶栏 | 底栏 | 背景 |
|------|------|------|------|------|
| **Idle · Tab 根** | 4 Tab 之一 | 大标题 36pt + 操作按钮 40px | NativeTabBar H83 | `#FFFFFF` 白 |
| **Idle · Push 子页** | 进入子页 | BackNavBar H48（‹ + 标题） | EngagementBar 或 InputBar 或 无 | `#FFFFFF` 白 |
| **封面页** | Idea/Agent 详情 | 透明浮层（44px 白圆） | EngagementBar | 封面图 + 白 |
| **Sheet** | Fork / Auth / Picker | 被遮罩 | 隐藏 Tab Bar | scale 0.95 + dim 0.4 |
| **Editing** | 评论/聊天聚焦 | 保持 Push Nav | 仅 BottomInputBar | 正常 |

---

## 触发展示矩阵

### Tab 根页（大标题 · 无返回）

| 视图 | 标题 | 右侧操作 |
|------|------|---------|
| `HomeView` | 探索 | 铃铛 40px |
| `ChatListView` | 对话 | 新建对话 pill（AI 渐变） |
| `ActivityScreen` | 动态 | 无 |
| `ProfileView` | 我的 | 设置 40px |

### Push 子页（返回导航栏）

| 视图 | 触发 | 标题 | 底栏 |
|------|------|------|------|
| `IdeaDetailView` | 想法卡片 | 无（封面模式） | EngagementBar |
| `SearchView` | 搜索 | 搜索栏 | 无 |
| `CommentsView` | 评论栏 | 评论 · 23 | BottomInputBar |
| `SettingsView` | 设置 | 设置 | 无 |
| `NotificationsView` | 铃铛/通知 | 通知 | 无 |
| `ChatThreadView` | 会话 | AI 头像 + 标题（无返回 nav，自定义） | BottomInputBar |
| `AgentProfileView` | Agent | 无（封面模式） | 无 |
| `UserProfileView` | 用户 | 无（封面模式） | 无 |

---

## 声明式 UI 架构（v6 伪代码）

```swift
// 根导航骨架 — 原生 TabView
TabView(selection: $tab) {
    NavigationStack { HomeView() }
        .tabItem { Label("探索", systemImage: "house.fill") }
        .tag(Tab.home)
    NavigationStack { ChatListView() }
        .tabItem { Label("对话", systemImage: "sparkles") }
        .tag(Tab.chat)
    NavigationStack { ActivityScreen() }
        .tabItem { Label("动态", systemImage: "bell.fill") }
        .tag(Tab.activity)
    NavigationStack { ProfileView() }
        .tabItem { Label("我的", systemImage: "person.fill") }
        .tag(Tab.profile)
}
.tint(Color(hex: "#2F6BE4"))

// Tab 根页内部 — 大标题
ScrollView {
    VStack(spacing: 24) {
        HStack {
            VStack {
                Text("副标题").font(.medium15).foregroundStyle(.secondary)
                Text("探索").font(.extrabold36)
            }
            Spacer()
            Button { } label: { Image(systemName: "bell") }
                .frame(40).background(Color.bgMuted).clipShape(.circle)
        }
        .padding(.horizontal, 24)
        // Content...
    }
    .padding(.bottom, 120)  // 清除 Tab Bar
}

// Push 子页 — 返回导航栏
NavigationStack {
    ChildView()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { dismiss() } label: { Image(systemName: "chevron.left") }
                    .frame(36).background(Color.bgMuted).clipShape(.circle)
            }
        }
}
```
