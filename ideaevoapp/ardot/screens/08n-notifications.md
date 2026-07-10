# S08N Notifications v5 · 通知（完整规格）

**Ardot frames:** `93:972` · 空态 `93:2088` · IA `109:65`  
**iOS:** `NotificationsView`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)  
**简版索引：** [`08-notifications.md`](./08-notifications.md)

### 📱 界面：S08N Notifications | 🎯 唯一核心任务：阅读通知并进入目标页

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐ marginH 16
│ [AtlasPushNavBar H44]                │
│ ‹ Hit44 | 通知 17pt Semibold | 全部已读 Hit44 │
├──────────────────────────────────────┤
│ [H-Scroll Filter chips peek 15%]     │ 全部/送花/评论/关注/Fork
│ h48                                  │
├──────────────────────────────────────┤
│ [V-Stack gap 10]                     │
│ ┌─ NotificationRow ────────────────┐ │
│ │ Avatar40 | title 17pt | time 13pt│ │
│ │ subtitle 15pt #666               │ │
│ │ unread: bg #FFF6D6 OR dot 8px    │ │
│ │ read: white + rule stroke        │ │
│ │ padding 16 r16 minH 64           │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

#### 2. Tokens

* 标题行 **17pt Semibold** / 副文 **15pt #666** / 时间 **13pt #999**
* Filter chips：**H-Scroll** 单行 · Capsule r12 · **Hit 44**
* 行 **minH 64** · 整行可点

#### 3. 状态机

* `[Idle]` → **suppressTabBar** · 无 PillTabBar
* `[全部已读]` → API · 未读样式清除
* `[Tap row]` → Push Idea/User/Agent · parallax **35%**

#### 4. 空状态 `93:2088`

* Image **120×120** + Text **17pt** — 见 `12-states.md`

#### 5. 伪代码

```swift
VStack {
    AtlasPushNavBar(hit: 44, trailing: TextButton("全部已读", 44))
    ScrollView(.horizontal) { filterChips } // peek 15%
    ScrollView {
        LazyVStack(spacing: 10) {
            ForEach(items) { NotificationRow(minH: 64, font: 17) }
        }.padding(.horizontal, 16)
    }
}.suppressTabBar()
```

## 导航

见 [`00-navigation-ia.md`](./00-navigation-ia.md) · Nav·Notifications A `109:143`

## API

`GET /notifications` · `POST /notifications/read-all` · `POST /notifications/read/:id`
