# S06 Chat List v5 · 对话列表

**Ardot frame:** `93:1013`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S06 Chat List | 🎯 唯一核心任务：选择会话并进入聊天线程

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐ marginH 16
│ [TabScreenHeader H44] 对话    [+]    │ + Hit 56 optional
├──────────────────────────────────────┤
│ [V-Stack sessions]                   │
│ ┌─ SessionRow flat minH 56 ────────┐ │
│ │ AgentAvatar40 | title 17pt       │ │
│ │ preview 15pt #666 | time 13pt    │ │
│ │ [Idea badge 20 if linked]        │ │
│ │ ─── 1px #EBEBEB ───────────────  │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ [PillTabBar]                         │
└──────────────────────────────────────┘
```

#### 2. Tokens

* 会话标题 **17pt Semibold** / 预览 **15pt #666** / 时间 **13pt #999**
* 列表 **V-Stack + Divider** — 禁止每会话独立卡片嵌套
* 行 **minH 56**，Hit **44×44** 整行

#### 3. 状态机

* `[Guest]` → `LoginView` 或 Auth Sheet
* `[Empty]` → 见 `12-states.md` Chat Empty
* `[Tap row]` → Push ChatThread；**隐藏 Tab Bar**

#### 4. 动效

* Push parallax **35%**

#### 5. 伪代码

```swift
VStack {
    TabScreenHeader("对话", 22.bold)
    ScrollView {
        LazyVStack(spacing: 0) {
            ForEach(sessions) { SessionRow(minH: 56, title: 17, preview: 15) ; Divider() }
        }.padding(.horizontal, 16)
    }
    PillTabBar()
}
```

## Idea 关联会话副标题

- slug **15pt** + Idea badge **20×20**
- 最近消息 **15pt #666** 一行

## API

`GET /sessions`
