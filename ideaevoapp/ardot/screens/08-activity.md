# S08 Activity v5 · 仓库协作动态

**Ardot frame:** `93:952`  
**空态：** `93:1646` · **关注需登录：** `93:1567`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S08 Activity · 协作 | 🎯 唯一核心任务：浏览仓库协作事件并进入相关 Idea

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐ marginH 16
│ [TabScreenHeader H44] 协作  [全局▾]  │ Title 22pt · Menu Hit 44
├──────────────────────────────────────┤
│ [V-Stack event list gap 0]           │
│ ┌─ ActivityRepoEvent (flat row) ────┐│
│ │ Avatar36 | body 17pt | IdeaThumb32││
│ │ meta 13pt #999                    ││
│ │ ─── 1px #EBEBEB ────────────────  ││
│ └───────────────────────────────────┘│
│   (repeat)                           │
├──────────────────────────────────────┤
│ [PillTabBar H62]                     │
└──────────────────────────────────────┘
```

#### 2. Tokens

* **排版**：Tab 标题 **22pt Bold** / 事件正文 **17pt Regular #222** / meta **13pt #999**
* **容器**：列表 **无外层卡片**；行间 **Divider 1px #EBEBEB**；`page-x` 16
* **热区**：整行可点 **minH 44** / 「全局」Menu **44×44**

#### 3. 状态机

* `[Idle]` → Tab Bar + 事件 `V-Stack`
* `[全局 Menu 展开]` → 统计/排行/筛选（**V-Stack** 或 Sheet，非 Grid）
* `[Tap 行]` → Push IdeaDetail；**隐藏 Tab Bar**

#### 4. 动效

* Push parallax **35%** · 列表插入 fade

#### 5. 空状态

* **动态空** `93:1646`：Text **22pt Bold** + **17pt** 副文 — **禁止** 假事件卡
* **关注需登录** `93:1567`：CTA **minH 44** → Login

#### 6. 伪代码

```swift
VStack {
    TabScreenHeader("协作", 22.bold, trailing: MenuButton(44))
    ScrollView {
        LazyVStack(spacing: 0) {
            ForEach(events) {
                ActivityRepoEvent(rowMinH: 44, body: 17, meta: 13)
                Divider().foregroundStyle(#E5E5E5)
            }
        }.padding(.horizontal, 16)
    }
    PillTabBar(hit: 44)
}
```

## 事件行 · `C/ActivityRepoEvent`

| 区域 | 规格 |
|------|------|
| 左 | Actor Avatar **36** |
| 中 | 事件文案 **17pt** + slug **15pt Semibold** + meta **13pt #999** |
| 右 | Idea Thumbnail **32** |
| 行高 | **min 44pt** 可点 |

## 事件类型

| 事件 | 示例 |
|------|------|
| fork | `林晓 forked smart-home-energy` → `mobile-app` |
| publish | `万叶助手 pushed commit to` **smart-home-energy** |
| star | 送花 / 点赞 |
| comment | Issue 讨论 |

## S08A Activity Full (`93:1951`)

与 Tab 页一致；统计/排行/筛选 **默认折叠**，Toggle 展开 — 内容区 **V-Stack only**。

## API

`GET /activity/feed` · `GET /activity/following`
