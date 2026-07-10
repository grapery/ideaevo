# S03 Chat · Idea 引用对话

**Ardot frame:** `93:904`  
**列表：** `93:1013` · **CTA：** `93:2044`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S03 Chat Thread | 🎯 唯一核心任务：与 Agent 对话并引用 Idea 上下文

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
┌──────────────────────────────────────┐
│ [AtlasPushNavBar H44] ‹ Agent名 17pt │ Share Hit44
├──────────────────────────────────────┤
│ [ScrollView V-Stack messages]        │
│   Bubble user 17pt #222              │
│   Bubble agent 17pt #222             │
│ ┌─ C/IdeaChatCard R16 p12 ─────────┐ │  // 与 Bubble 同级，非嵌套
│ │ [tint band] Avatar40 slug15       │ │
│ │ Title 17pt Semibold 1 line        │ │
│ │ Meta 13pt #999                    │ │
│ │ [查看 Hit44]                      │ │
│ └───────────────────────────────────┘ │
│   Bubble agent …                     │
├──────────────────────────────────────┤
│ [C/BottomInputBar H56]               │  Field 17pt + Send Hit44
└──────────────────────────────────────┘
```

#### 2. 元素样式、字阶与 Token 约束

* **排版**：Nav 标题 **17pt Semibold** / 消息 **17pt Regular #222** / Idea 卡标题 **17pt Semibold** / slug **15pt Semibold** / meta **13pt #999**
* **间距容器**：`page-x` **16px** · Idea 卡 **r16 p12** · 消息区 **V-Stack gap 8**
* **触控热区**：返回/分享/发送/**查看** 均 **44×44** · 整卡可点 **minH 44**

#### 3. 上下文状态机切换逻辑

* `[Idle · 浏览]` → `AtlasPushNavBar` + 消息 `V-Stack` + `BottomInputBar` · **隐藏 Tab Bar**
* `[Editing · 输入聚焦]` → 保持 Nav · **仅** `BottomInputBar` h56 贴键盘 · 隐藏其他底栏
* `[Tap IdeaChatCard]` → Push `IdeaDetailView` · parallax **35%**

#### 4. 物理微动效与手势声明

* Swipe back：**35%** 视差
* 新消息：列表底部 spring scroll
* Sheet（反馈/举报）：**scale 0.95 + dim 0.4**

#### 5. 双重空状态表现细节

* **会话空**：见 `12-states.md` S06E — Image **120×120** → **22pt Bold**「开始对话」→ **17pt** 副文 → 无嵌套空卡
* **搜索无结果**：不适用（本屏无搜索）

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 0) {
    AtlasPushNavBar(title: 17.semibold, trailing: Share(44))
    ScrollView {
        VStack(spacing: 8) {
            ForEach(messages) { msg in
                if msg.isIdeaCard {
                    IdeaChatCard(radius: 16, padding: 12) // NO bubble wrap
                } else {
                    ChatBubble(font: .body17)
                }
            }
        }.padding(.horizontal, 16)
    }
    BottomInputBar(height: 56, sendTarget: 44)
}
.suppressTabBar()
```

---

## `C/IdeaChatCard` · `93:921`

| 元素 | 规格 |
|------|------|
| 容器 | **r16 p12** 单卡 · tint @12% |
| 头像 | **40** |
| Slug | **15pt Semibold** |
| 标题 | **17pt Semibold** 一行 |
| Meta | **13pt #999** 创建者 · 进度 · stats |
| CTA | 「查看」**minH 44** 或 Text Button Hit 44 |
| 布局 | 消息流内 **独立块** — 禁止套在 Bubble 卡内 |

## `C/IdeaChatCTA` · Idea Detail `93:2044`

| 元素 | 规格 |
|------|------|
| 容器 | **r16** outline 或 fill 单卡 |
| 文案 | **17pt Semibold** `带着 {slug} 问 Agent` |
| Meta | **15pt #666** |
| Hit | 整卡 **minH 44** |

## Chat List · Idea 关联

- 副标题 slug **15pt** + badge **20**
- 预览 **15pt #666**
- 列表 **V-Stack + Divider** — 禁止 Grid

## API

`POST /chat/sessions` · `idea_id` 可选
