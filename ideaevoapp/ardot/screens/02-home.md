# S02 Home v5 · Idea 仓库发现

**Ardot frame:** `93:927`  
**Feed card:** `C/IdeaFeedCard` · `93:944`  
**身份原则：** [`00-idea-identity.md`](./00-idea-identity.md)  
**Marvel V4.0 评审：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S02 Home · 探索 | 🎯 唯一核心任务：浏览 Idea 仓库 Feed 并进入详情或发布

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
┌──────────────────────────────────────┐ marginH 16
│ [TabScreenHeader H44] 探索    (+)(🔔) │ Hit 56 / 44
│ [SearchBar H50 R12] 占位搜索…         │
│ [H-Scroll Chips peek 15%]             │
│ [PillSegmented H40] 趋势 | 关注       │
├──────────────────────────────────────┤
│ [V-Stack Feed gap 10]                 │
│ ┌─ IdeaFeedCard R16 ───────────────┐ │
│ │ [IdeaCardHero H96 tint band]      │ │
│ │ ─── body padding 16 ────────────  │ │
│ │ Title 17pt Semibold              │ │
│ │ Summary 17pt Regular 2 lines     │ │
│ │ Chips row                        │ │
│ │ ─── 1px #EBEBEB ───────────────  │ │
│ │ Stats row 13pt                   │ │
│ └──────────────────────────────────┘ │
│   (repeat)                           │
├──────────────────────────────────────┤
│ [PillTabBar H62 float offset 12]     │ 4 tabs, hit 44
└──────────────────────────────────────┘
```

#### 2. 元素样式、字阶与 Token 约束

* **排版**：Tab 标题 `mobile-title` **22pt Bold #111** / 卡片标题 **17pt Semibold #222** / 摘要 **17pt Regular #222** / slug **15pt Semibold** / 时间 **13pt #999**
* **间距容器**：`page-x` **16px** / 卡片 **r16 padding 16** / 内部统计区 **Divider 1px #EBEBEB**
* **触控热区**：`+` **56×56** / 铃铛 **44×44** / SearchBar 整行 **minH 50** / Feed 卡整卡可点

#### 3. 上下文状态机切换逻辑

* `[Idle · 趋势/关注]` → `PillTabBar` + `TabScreenHeader` + Feed `V-Stack`
* `[Tap +]` → Push `PublishIdeaView`；**隐藏 Tab Bar**
* `[Tap 搜索]` → Push `SearchView`；**隐藏 Tab Bar**
* `[Segment 关注 + 未登录]` → 内联 CTA 或 Auth Sheet；Tab Bar 保持

#### 4. 物理微动效与手势声明

* Push Idea Detail：`matchedGeometryEffect` avatar；返回 **parallax 35%**
* Long press Feed 卡（可选）：**blur 20px** + **scale 1.05** + 分享/收藏菜单 r12
* Pull refresh：列表顶部 spring 回弹

#### 5. 双重空状态表现细节

* **广场空（首次内容）**：全屏 **无空卡片** → Image **120×120** → Text **22pt Bold**「广场还没有想法」→ Text **17pt** 副文 → Button「发布想法」**Target 44×44** → **Popover 指向 Header `+`**
* **关注空**：Image 120 → **15pt #666**「还没有关注任何人」→ CTA Push Agent Explore
* **搜索无结果**：见 [S03 Search Empty](./03-search-results.md#搜索无结果--marvel-v40)

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 0) {
    TabScreenHeader(title: 22.bold, trailing: [PlusButton(56), Bell(44)])
    SearchBar(height: 50, radius: 12, marginH: 16)
    ScrollView(.horizontal) { HStack { chips } } // peek 15%
    PillSegmented(items: ["趋势","关注"])
    ScrollView {
        VStack(spacing: 10) {
            ForEach(ideas) { idea in
                Card(radius: 16) {
                    IdeaCardHero(height: 96)
                    VStack(spacing: 12) {
                        Text(idea.title).font(.system(size: 17, weight: .semibold))
                        Text(summary).font(.system(size: 17))
                        chipsRow
                        Divider().foregroundStyle(#E5E5E5)
                        statsRow.font(.caption13)
                    }.padding(16)
                } // NO nested Card
            }
        }.padding(.horizontal, 16)
    }
    PillTabBar(items: 4, hitTarget: 44)
}
```

---

## IdeaFeedCard · `93:944`

### `C/IdeaCardHero` · 顶栏 96h（`129:41`）

| 区域 | 规格 |
|------|------|
| **Tint 背景** | 创建者头像主色渐变 @12% → 透明 |
| **Idea 头像** | `C/IdeaAvatar 48` · icon / DiceBear / 用户上传 |
| **Slug** | `smart-home-energy` · **15pt Semibold** |
| **创建者** | 用户头像 18 + `张三 创建 · 万叶助手` · **15pt #666** |
| **时间** | `创建于 M月d日 · 更新 feedTimestamp` · **13pt #999** |
| **Mini Stats** | ⑂ · ✿ · ♥ · 💬 · icon 13 · count 11 |

### Body

| 区域 | 规格 |
|------|------|
| **Title** | 完整标题 · **17pt Semibold #222** |
| **Summary** | README 摘要 · **17pt Regular** · 最多 2 行 |
| **Chips** | 状态 · category · tags · Capsule r12 |
| **Stats** | 顶 **1px #EBEBEB** 后完整统计行 · **13pt** |

**时间格式（iOS `Date.feedTimestamp`）：** 今天 HH:mm · 昨天 HH:mm · M月d日 HH:mm · yyyy/M/d HH:mm

## 布局硬规则（本屏）

- Chips：**H-Scroll 单行**，右侧 **peek 15%**
- Feed：**V-Stack only** — 禁止 Section 内 LazyVGrid
- **禁止** IdeaFeedCard 内再套完整子卡片

## API

- `GET /ideas` · `GET /activity/following` · `GET /ideas/search`
