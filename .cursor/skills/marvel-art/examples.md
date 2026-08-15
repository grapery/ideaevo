# Marvel Art · Examples (V4.0 Output)

## Example: Idea Detail · 仓库主页

### 📱 界面：Idea Detail · 仓库主页 | 🎯 唯一核心任务：阅读 README 并完成一次社交动作（♥ / ✿ / ⑂ / 💬）

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
┌──────────────────────────────────────┐ Page margin 16px
│ [HeaderBar H44] ‹    (share)(⋯)     │ Touch 44x44 each
├──────────────────────────────────────┤
│ ┌─ Card R16 P16 ──────────────────┐  │
│ │ [Avatar 56] slug 15pt Bold      │  │
│ │ creator 12pt | times 11pt       │  │
│ │ mini stats row                  │  │
│ └─────────────────────────────────┘  │
│ [H-Scroll RepoTabs peek 15%]         │
│ README | Forks 3 | Activity | 讨论   │
├──────────────────────────────────────┤
│ [V-Stack content]                    │
│  Triangle                            │
│  StatusPill                          │
│  Title 22pt Bold                     │
│  Markdown Body 17pt                  │
│  ┌─ Card R16 ───────────────────┐   │
│  │ Fork row 1                     │   │
│  │ ─── 1px #E5E5E5 ───────────── │   │
│  │ Fork row 2                     │   │
│  └────────────────────────────────┘   │
│  FlowersPreviewCard -> push          │
├──────────────────────────────────────┤
│ [EngagementBar H72, 4col, target44]  │
└──────────────────────────────────────┘
```

#### 2. 元素样式、字阶与 Token 约束

* **排版**：Title 22pt Bold #111 / Body 17pt Regular #222 / slug 15pt Semibold #222 / meta 13pt #999
* **间距容器**：Page 16px / Card 16px radius 16px padding / 内部 `Divider 1px #E5E5E5`
* **触控热区**：Nav icons 44×44 / Engagement 每列 min 44×44

#### 3. 上下文状态机切换逻辑

* `[Idle]` -> `EngagementBar` visible / no edit toolbar
* `[Tap Fork]` -> hide nothing / present `[BottomSheet: Handle 40x4 -> Title 17pt Bold "Fork" -> X + Check -> form V-Stack]`
* `[Sheet open]` -> root `scale(0.95)` + `dim 0.4`

#### 4. 物理微动效与手势声明

* Push enter: slide from right; avatar `matchedGeometryEffect`
* Swipe back: current 100% out, feed layer +35% parallax
* Long press Idea card (feed): blur 20px + scale 1.05x + action menu radius 12px

#### 5. 双重空状态

* 初次登录：N/A（从 Feed 进入）
* 搜索无结果：N/A

#### 6. 声明式 UI 架构伪代码

```swift
struct IdeaDetailView: View {
    @State private var sheetScale: CGFloat = 1.0
    var body: some View {
        VStack(spacing: 0) {
            HeaderBar(height: 44, left: .back, right: [.share, .more], target: 44)
            ScrollView {
                VStack(spacing: 16) {
                    IdeaIdentityHero(idea) // Card R16, no inner card
                    RepoTabs()             // H-Scroll, peek 15%
                    readmeContent          // V-Stack only
                    FlowersPreviewCard(onOpen: pushFlowers)
                }
                .padding(.horizontal, 16)
            }
        }
        .scaleEffect(sheetScale)
        .safeAreaInset(edge: .bottom) {
            EngagementBar(height: 72, columns: 4, minTarget: 44)
        }
    }
}
```

---

## Example: 探索 · 搜索无结果

### 📱 界面：探索 · 搜索无结果 | 🎯 唯一核心任务：修正查询或一键清除搜索条件

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐
│ [HeaderBar H44] 探索    (+) (bell)   │
│ [SearchBar H50 R12 margin 16]          │
├──────────────────────────────────────┤
│           (flex space)               │
│      [Image 120x120 placeholder]     │
│           Spacer 12                    │
│  Text 15pt #666 未找到与「XX」...      │
│           Spacer 16                    │
│  [H-Scroll chips: 建议词 peek 15%]   │
│           Spacer 24                    │
│  [Button 清除搜索 H48 full-32 margin]  │
│           (flex space)               │
│ [FloatingBottomBar - 4 tabs]           │
└──────────────────────────────────────┘
```

#### 2. Tokens

* Title 22pt Bold / hint 15pt #666 / button 17pt Active / chip 15pt #666
* 无嵌套卡片；建议词 Capsule R12
* Button target ≥ 44×44

#### 3. 状态机

* `[Idle + empty query]` -> 正常 Feed
* `[Active query + zero results]` -> 替换列表为 EmptyStateView，**保留** SearchBar + BottomBar

#### 4. 微动效

* Empty state fade-in + translateY 8px spring
* Tap chip -> replace query + re-search
* Swipe back: parallax 35%

#### 5. 空状态

* 初次登录：不适用
* 搜索无结果：`[EmptyStateView 完整结构见上]`

#### 6. 伪代码

```swift
if results.isEmpty && !query.isEmpty {
    EmptyStateView(
        image: 120,
        text: "没有找到与「\(query)」匹配的数据",
        font: .subheadline15,
        suggestions: HScroll(peek: 0.15) { chips },
        button: ("一键清除搜索条件", .body17, target: 44)
    )
}
```

---

## Anti-pattern → V4.0 rewrite

| ❌ 抽象/违规 | ✅ V4.0 改写 |
|-------------|-------------|
| “底部栏简洁现代” | `[FloatingBottomBar: offsetBottom 12px, height 60px, items 4, centerAction 56x56, target 44x44]` |
| Card 内 Card | `Divider 1px #E5E5E5` + `Spacer 12` |
| LazyVGrid 4列送花者 | `H-Scroll height 72, avatar 48, peek 15%` 或 `V-Stack` 列表行 |
| “Sheet 优雅弹出” | `scaleEffect(0.95) + Color.black.opacity(0.4) + Handle 40x4` |
