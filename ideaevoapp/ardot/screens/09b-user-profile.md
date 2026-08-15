# S09B User Profile v5 · 他人主页

**Ardot frame:** `93:833`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S09B User Profile | 🎯 唯一核心任务：浏览该用户发布的 Idea 仓库列表

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
┌──────────────────────────────────────┐
│ [AtlasPushNavBar H44] ‹ 更多 Hit44   │
│ [ProfileBanner H132 + float card R20]│
│   Avatar72 | name 22pt Bold         │
│   bio 17pt #222 | stats strip       │
│   [关注/对话 btn minH 44]            │
│ [H-Scroll tabs peek 15%] 想法|Fork|动态│
├──────────────────────────────────────┤
│ [V-Stack IdeaCardCompact]            │
│   row minH 56: Avatar40 slug15      │
│   title 17pt | meta 13pt #999        │
│   ─── Divider #E5E5E5 ───            │
└──────────────────────────────────────┘
```

#### 2. 元素样式、字阶与 Token 约束

* **排版**：昵称 **22pt Bold** / bio **17pt Regular #222** / 卡标题 **17pt Semibold** / slug **15pt Semibold** / meta **13pt #999**
* **间距容器**：`page-x` **16px** · float 卡 **r20** · 列表 **flat + Divider** — **禁止卡中卡**
* **触控热区**：关注/对话 **minH 44** · Tab 项 **44×44** · 更多 **Hit 44**

#### 3. 上下文状态机切换逻辑

* `[Idle · 浏览]` → `AtlasPushNavBar` + Banner + **H-Scroll** tabs + `V-Stack` 列表 · **隐藏 Tab Bar**
* `[Tab 切换]` → 仅内容区切换；tabs **H-Scroll peek 15%**
* `[Tap Idea 行]` → Push Idea Detail · parallax **35%**
* `[Tap ⋯]` → User Action Menu Sheet · **scale 0.95 dim 0.4**

#### 4. 物理微动效与手势声明

* Swipe back：**35%** 视差
* Long press Idea 行（可选）：**blur 20px + scale 1.05** + 分享菜单 r12
* Banner 滚动：float 卡 **heroOverlap 36** 叠层

#### 5. 双重空状态表现细节

* **用户无 Idea**：Image **120×120** → **22pt Bold**「还没有发布想法」→ **17pt** 副文 — **禁止** 空容器卡墙
* **搜索无结果**：不适用

#### 6. 声明式 UI 架构伪代码

```swift
ScrollView {
    VStack(spacing: 16) {
        ProfileFloatBanner(height: 132, cardRadius: 20)
        ScrollView(.horizontal) { HStack { tabs } } // peek 15%
        VStack(spacing: 0) {
            ForEach(ideas) { idea in
                IdeaCardCompact(avatar: 40, title: 17.semibold)
                Divider().foregroundStyle(#E5E5E5)
            }
        }
    }.padding(.horizontal, 16)
}
.suppressTabBar()
```

---

## `C/IdeaCardCompact` · `93:865`

| 元素 | 规格 |
|------|------|
| 头像 | **40** · r12 |
| Slug | **15pt Semibold #222** |
| 标题 | **17pt Semibold** 一行 |
| Meta | **13pt #999** `创建于 … · 实现 N% · ⑂ N` |
| 容器 | 列表项 **flat** + Divider；或单列 **r16** 卡（**禁止** 卡中卡） |
| 行高 | **minH 44** |

与 `C/IdeaCardHero` 相比更紧凑，**无 tint 顶栏**（密度优先）。

## API

`GET /users/:id/ideas`
