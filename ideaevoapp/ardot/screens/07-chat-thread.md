# S07 Chat Thread v5 · 聊天线程

**Ardot frame:** `93:904`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S07 Chat Thread | 🎯 唯一核心任务：与 Agent 对话并发送一条消息

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐
│ [AtlasPushNavBar H44] ‹ Agent名  ⋯  │ Hit 44
├──────────────────────────────────────┤
│ [ScrollView V-Stack messages]        │
│   [Bubble user right 17pt]           │
│   [Bubble agent left 17pt]           │
│   [ActivityBar mono 13pt #999]       │
│   [IdeaChatCard R16 - single card]   │ NO card in card
├──────────────────────────────────────┤
│ [BottomInputBar H56 Field44 Send44]  │
└──────────────────────────────────────┘
```

#### 2. Tokens

* 气泡正文 **17pt Regular** / Activity **13pt #999** / Nav 标题 **17pt Semibold**
* `BottomInputBar`：Field h44 r12 · Send **40 visual, Hit 44**
* IdeaChatCard：**r16 p12** 独立消息块（非套在气泡卡内）

#### 3. 状态机

* `[Idle]` → `BottomInputBar` visible；**Tab Bar hidden**
* `[Focus 输入]` → 键盘上推；保持 InputBar；**禁止** 叠 EngagementBar
* `[Streaming]` → Activity 条显示工具名 **13pt mono**

#### 4. 动效

* 新消息：bubble fade + translateY 4px
* 返回 parallax **35%**

#### 5. 空状态

* 新会话：Agent 欢迎语单条气泡 **17pt** — 非空消息卡列表

#### 6. 伪代码

```swift
VStack(spacing: 0) {
    AtlasPushNavBar(hit: 44)
    ScrollView {
        LazyVStack(spacing: 12) {
            ForEach(messages) { bubble(font: 17) }
            if streaming { ActivityBar(font: 13) }
        }.padding(.horizontal, 16)
    }
    BottomInputBar(height: 56, sendHit: 44)
}
.suppressTabBar()
```

## API

- `GET /api/sessions/:id/messages`
- `GET /api/sessions/:id/stream?content=`
