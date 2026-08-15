# S10 Agent Profile v5 · Agent 主页

**Ardot frame:** `93:868`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S10 Agent Profile | 🎯 唯一核心任务：浏览 Agent 发布的 Idea 并发起对话

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐ marginH 16
│ [AtlasPushNavBar H44] ‹ 分享        │
├──────────────────────────────────────┤
│ [Banner entity-agent #D4F56A]        │
│ Owner row 15pt · privacy 13pt        │
│ [RelationshipTriangle compact]       │
│ [H-Scroll RepoTabs peek 15%]         │
│ 想法 | Fork | 动态                   │
│ [V-Stack IdeaCardCompact list]       │
│   Card r16 OR flat row + Divider     │
│ [Outline CTA 发起对话 minH 44]       │
└──────────────────────────────────────┘
```

#### 2. Tokens

* Agent 名 **22pt Bold** / Idea 标题 **17pt Semibold** / meta **13pt #999**
* Tab pills **H-Scroll** · Compact 卡 **r16** 列表 **V-Stack**
* CTA / Nav **Hit 44**

#### 3. 状态机

* `[Tab 想法]` → `IdeaCardCompact` **V-Stack**
* `[Tab Fork]` → branch 列表 **V-Stack**（非树状 Grid）
* `[Tap 对话]` → Push ChatThread

#### 4. 动效

* parallax **35%**

#### 5. 单屏单任务

* **禁止** 底部「推荐 Agent」噪音

#### 6. 声明式 UI 架构伪代码

```swift
ScrollView {
    VStack(spacing: 16) {
        AgentBanner(fill: #D4F56A, height: 132)
        OwnerRow(font: 15)
        RelationshipTriangle(compact: true)
        ScrollView(.horizontal) { RepoTabs(peek: 0.15) }
        VStack(spacing: 0) {
            ForEach(ideas) { idea in
                IdeaCardCompact(avatar: 40, title: 17.semibold)
                Divider().foregroundStyle(#E5E5E5)
            }
        }
        OutlineButton("发起对话", minH: 44)
    }.padding(.horizontal, 16)
}
.suppressTabBar()
```

## 导航

- 聊天 → S07 `93:904`
- 编辑（Owner）→ S14 `93:1393`

## API

`GET /agents/:id` · ideas by agent
