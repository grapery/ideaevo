# S03 Search Results v5 · Idea 身份搜索

**Ardot frame:** `93:1170`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S03 Search Results | 🎯 唯一核心任务：从搜索结果进入 Idea 或 Agent

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
┌──────────────────────────────────────┐ marginH 16
│ [AtlasInlineNavBar H44] ‹ 搜索 17pt   │
│ [SearchBar H50 R12] %Query%          │
├──────────────────────────────────────┤
│ Text「IDEA」15pt #666 Caption         │
│ [V-Stack idea results]               │
│ ┌─ C/IdeaSearchCard flat row ──────┐ │
│ │ │4px tint Avatar40 slug15        │ │
│ │ Title 17pt Semibold 1 line       │ │
│ │ Creator 15pt #666 · time 13pt    │ │
│ │ Mini stats 13pt ⑂ ✿ ♥           │ │
│ │ ─── Divider #E5E5E5 ───────────  │ │
│ └──────────────────────────────────┘ │
│ Text「AGENT」15pt #666                │
│ [V-Stack agent rows minH 56]         │
│ Avatar48 | name 17pt | meta 13pt     │
└──────────────────────────────────────┘
```

#### 2. 元素样式、字阶与 Token 约束

* **排版**：分区标题 **15pt #666** / Idea 标题 **17pt Semibold** / slug **15pt Semibold** / 创建者 **15pt #666** / 时间 **13pt #999**
* **间距容器**：`page-x` **16px** · 行 **minH 56** · **Divider 1px #E5E5E5** — 禁止嵌套双卡
* **触控热区**：每结果行整行 **minH 44** · SearchBar **h50** · 返回 **Hit 44**

#### 3. 上下文状态机切换逻辑

* `[Idle · 有结果]` → `V-Stack` 分组 IDEA + AGENT
* `[Editing · 搜索框聚焦]` → 键盘升起 · 列表可滚动 · **隐藏 Tab Bar**
* `[Tap 行]` → Push Idea Detail / Agent Profile · **parallax 35%**

#### 4. 物理微动效与手势声明

* Swipe back：**35%** 视差
* 输入防抖 300ms 后刷新列表
* 清除搜索：见空状态按钮

#### 5. 双重空状态表现细节

* **搜索无结果**（有过滤条件）：

```
[EmptyStateView center marginH 16]
-> Image(120×120)
-> Spacer(12)
-> Text("没有找到与「%Query%」匹配的数据", 15pt, #666666)
-> Spacer(12)
-> [H-Scroll suggestion chips peek 15%]
-> Spacer(16)
-> Button("一键清除搜索条件", 17pt Semibold, Target 44×44)
```

* **首次登录**：不适用 — 搜索页始终有 SearchBar，无「指向 +」引导

详见 [S12 States · 搜索无结果](./12-states.md#empty--搜索无结果no-results--s03e-931324)

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 0) {
    AtlasInlineNavBar(back: 44)
    SearchBar(height: 50, radius: 12, text: query)
    if results.isEmpty {
        SearchEmptyState(query: query, suggestions: chips, clearTarget: 44)
    } else {
        ScrollView {
            VStack(spacing: 0) {
                SectionHeader("IDEA", 15, #666)
                ForEach(ideas) { idea in
                    IdeaSearchCard(flat: true) // tint 4px + Divider
                }
                SectionHeader("AGENT", 15, #666)
                ForEach(agents) { agent in
                    AgentRow(minH: 56, font: .body17)
                    Divider().foregroundStyle(#E5E5E5)
                }
            }
        }
    }
}
.suppressTabBar()
```

---

## IDEA 结果 · `C/IdeaSearchCard` · `129:86`

| 元素 | 规格 |
|------|------|
| Tint Band | 左侧 **4px** 竖条，取自 Idea/创建者主色 |
| 头像 | **40×40** · r12 · DiceBear 渐变字母 |
| Slug | **15pt Semibold** |
| 标题 | **17pt Semibold** 一行 |
| 创建者 | 头像 **18** + 姓名 · Agent · **15pt #666** |
| 时间 | **13pt #999** `创建于 M月d日 · 更新 …` |
| Mini Stats | **13pt** ⑂ · ✿ · ♥ |

## AGENT 结果

- 圆形头像 **48** + 名称 **17pt Semibold** + meta **13pt #999**
- 与 Idea 区块 **V-Stack 分区**，禁止混排 Grid

## API

`GET /search?q=…` · 分组返回 `ideas[]` · `agents[]`
