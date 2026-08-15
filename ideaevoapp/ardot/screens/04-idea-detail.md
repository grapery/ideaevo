# S04 Idea Detail v5 · IdeaHub Repo

**Ardot frame:** `93:759`  
**身份原则：** [`00-idea-identity.md`](./00-idea-identity.md)  
**Marvel V4.0 评审：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

Idea **仓库主页** · User→Agent→Idea 三角 · Fork/Branch 协作。

### 📱 界面：S04 Idea Detail | 🎯 唯一核心任务：阅读 README 并完成一次社交动作（♥ / ✿ / ⑂ / 💬）

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
┌──────────────────────────────────────┐ marginH 16
│ [AtlasPushNavBar H44] ‹  (分享)(⋯)  │ Hit 44 each
├──────────────────────────────────────┤
│ [ScrollView V-Stack gap 16]          │
│ ┌─ IdeaIdentityHero R16 minH100 ────┐ │
│ │ Avatar56 slug15 creator15 times13 │ │
│ │ mini stats                        │ │
│ └───────────────────────────────────┘ │
│ [H-Scroll RepoTabs peek 15%]           │
│ README | Forks N | Activity | 讨论    │
│ [RelationshipTriangle]               │
│ [StatusPill]                         │
│ [Title 22pt Bold]                    │
│ [ImplProgress - single card]         │
│ [Markdown 17pt Regular]              │
│ ┌─ Fork Bento R20 entity-idea ─────┐ │
│ │ Title 17pt Bold                  │ │
│ │ CTA pill                         │ │
│ │ child row 1                      │ │
│ │ ─── 1px #EBEBEB ───────────────  │ │
│ │ child row 2                      │ │ NO inner Card
│ └──────────────────────────────────┘ │
│ ┌─ FlowersPreviewCard R16 ─────────┐ │
│ │ header row + H-Scroll avatars    │ │
│ │ outline button                   │ │
│ └──────────────────────────────────┘ │
│ tags chips · impl meta · chat CTA    │
├──────────────────────────────────────┤
│ [EngagementBar H72 4col hit 44]      │
└──────────────────────────────────────┘
```

#### 2. 元素样式、字阶与 Token 约束

* **排版**：详情标题 **22pt Bold #111** / README **17pt Regular #222** / slug **15pt Semibold** / meta **13pt #999**
* **间距容器**：`page-x` 16 / Hero & Preview **r16 p16** / Fork Bento **r20 p16** / 列表行 **Divider 1px #EBEBEB**
* **触控热区**：Nav **44×44** / Engagement 每列 **44×44** / Fork CTA pill **minH 44**

#### 3. 上下文状态机切换逻辑

* `[Idle · README tab]` → `EngagementBar` visible / `PillTabBar` hidden
* `[Tap ✿ / FlowersPreview]` → Push `FlowersGridView`；Engagement ✿ 高亮
* `[Tap Fork CTA]` → Sheet Fork；根视图 **scale 0.95 + dim 0.4**
* `[Tap 讨论 tab]` → 内联 CTA 或 Push Comments；底栏切 `BottomInputBar` on Comments 页
* `[RepoTab Forks]` → **V-Stack** 展示完整 Fork 列表（非 Grid）

**单屏单任务：** 本页 **禁止**「猜你喜欢」「相似 Idea」「历史浏览」等尾部噪音（相似 Idea 仅在 Publish Sheet `S04SIM`）。

#### 4. 物理微动效与手势声明

* 进入：Push 右入；Feed avatar `matchedGeometryEffect` → Hero
* 返回：**parallax 35%** on underlying Feed
* Fork Sheet：**Zoom 95% + Dim 0.4** on detail root
* Long press（可选）：无

#### 5. 双重空状态

* 本页不适用首次登录空态
* FlowersPreview 无送花者：Text **15pt #666**「还没有人送花」+ Outline CTA（非空卡片墙）

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 0) {
    AtlasPushNavBar(hit: 44)
    ScrollView {
        VStack(spacing: 16) {
            IdeaIdentityHero() // single card
            RepoTabs()         // H-Scroll peek 15%
            switch tab {
            case .readme:
                RelationshipTriangle()
                StatusPill()
                Text(title).font(.system(size: 22, weight: .bold))
                MarkdownBody(font: 17)
                ForkBento { // one card, rows + Divider
                    ForEach(children) { row; Divider() }
                }
                FlowersPreviewCard { HScroll avatars peek 0.15 }
            case .forks: forkBentoExpanded // V-Stack
            case .activity: placeholder VStack
            case .discussion: commentsCTA Card
            }
        }.padding(.horizontal, 16)
    }
    EngagementBar(height: 72, columns: 4, hit: 44)
}
```

---

## 结构（组件索引）

1. `[AtlasPushNavBar H44]` · ‹ Hit44 · 分享 Text pill Hit44 · ⋯ Hit44
2. **`C/IdeaIdentityHero`** `129:18` — Avatar **56** · slug **15pt** · 创建者 **15pt** · 时间 **13pt** · stats · tint
3. **`C/RepoTabs`** — **H-Scroll** · README · Forks · Activity · 讨论 · peek **15%**
4. **RelationshipTriangle** `93:747`
5. Status Pill + **Title 22pt Bold**
6. **README** Markdown **17pt** + Implementation 进度（单卡或 inline，无嵌套卡）
7. **Fork Bento** — 单卡 + **Divider** 分隔子 Fork 行
8. **FlowersPreviewCard** — 汇总 + **H-Scroll** 头像预览 → Push S04F
9. **`C/EngagementBar`** `129:352` — h72 · 4 等分 · Hit **44** · 无 Tab Bar

## 子流程

- 评论 → S05 `93:991`
- 鲜花全屏 → S04F `93:1671`
- Fork → S12 Fork Sheet `93:1206`
- 谱系 → S04D `93:1136`
- Owner 编辑 → S04E `93:1422`
