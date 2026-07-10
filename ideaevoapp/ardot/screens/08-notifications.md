# S08N Notifications v5 · 通知（简版）

> **完整规格：** [`08n-notifications.md`](./08n-notifications.md)（Filter chips · 未读底色）  
> **Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

**Ardot frame:** `93:972`

### 📱 界面：S08N Notifications | 🎯 唯一核心任务：阅读通知并进入目标 Idea/用户

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
┌──────────────────────────────────────┐ marginH 16
│ [AtlasPushNavBar H44] ‹ 通知 17pt     │ 全部已读 Hit44
├──────────────────────────────────────┤
│ [V-Stack notification rows]          │
│ row minH 64 bg #FFF6D6 if unread     │
│   dot 8px | title 17pt | body 15pt   │
│   time 13pt #999                     │
│ ─── Divider #E5E5E5 ───              │
└──────────────────────────────────────┘
```

> Filter chips **H-Scroll peek 15%** 见完整版 `08n-notifications.md`

#### 2. 元素样式、字阶与 Token 约束

* **排版**：标题 **17pt Semibold** / 正文 **15pt #666** / 时间 **13pt #999**
* **间距容器**：`page-x` **16px** · 行 **minH 64** · **Divider 1px #E5E5E5**
* **触控热区**：返回/全部已读 **44×44** · 行整行可点

#### 3. 上下文状态机切换逻辑

* `[Idle · 列表]` → Push Nav + `V-Stack` · **suppressTabBar**
* `[Tap 行]` → Push Idea/User · parallax **35%**
* `[全部已读]` → 清除未读底色 · API batch read

#### 4. 物理微动效与手势声明

* Swipe back：**35%** 视差
* 未读 → 已读：行背景 fade `#FFF6D6` → clear 200ms

#### 5. 双重空状态表现细节

* **通知空**：见 `12-states.md` S08NE — **22pt Bold** + **17pt** 副文 — **禁止** 空容器卡墙
* **筛选无结果**：**15pt #666**「没有此类通知」+ 清除筛选 **Hit 44**

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 0) {
    AtlasPushNavBar(title: 17.semibold, trailing: MarkAllRead(44))
    VStack(spacing: 0) {
        ForEach(notifications) { n in
            NotificationRow(minH: 64, title: 17, body: 15)
            Divider().foregroundStyle(#E5E5E5)
        }
    }
}
.suppressTabBar()
```

## API

`GET /notifications` · `POST /notifications/read/:id`
