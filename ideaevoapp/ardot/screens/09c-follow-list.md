# S09C Follow List v5 · 粉丝/关注

**Ardot frame:** `93:1151`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S09C Follow List | 🎯 唯一核心任务：浏览粉丝或关注列表并进入用户主页

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
┌──────────────────────────────────────┐ marginH 16
│ [settingsBackHeader H44] ‹            │
│ [H-Scroll PillTab 粉丝|关注 peek15%]  │
├──────────────────────────────────────┤
│ [V-Stack user rows]                  │
│ Avatar48 | name 17pt Semibold        │
│          | meta 13pt #999            │
│          | [关注 btn minH 44]        │
│ ─── Divider #E5E5E5 ───              │
│ (repeat)                             │
└──────────────────────────────────────┘
```

#### 2. 元素样式、字阶与 Token 约束

* **排版**：用户名 **17pt Semibold** / meta **13pt #999** / Tab **15pt**
* **间距容器**：`page-x` **16px** · 行 **minH 56** · **Divider 1px #E5E5E5**
* **触控热区**：返回 **44×44** · 关注按钮 **minH 44** · Tab **44×44**

#### 3. 上下文状态机切换逻辑

* `[Idle · 粉丝/关注]` → `settingsBackHeader` + **H-Scroll** PillTab + `V-Stack` 列表
* `[Tab 切换]` → 刷新列表 API；保持 Header
* `[Tap 行]` → Push User Profile · parallax **35%**
* `[Tap 关注]` → 切换状态；按钮保持 **44** 热区

#### 4. 物理微动效与手势声明

* Swipe back：**35%** 视差
* 关注状态切换：按钮 fill spring 150ms

#### 5. 双重空状态表现细节

* **关注列表空**：见 `12-states.md` S09CE — Image **64×64** tint `#FFF4A8` → **22pt Bold**「还没有关注任何人」→ **17pt**「去发现有趣的创作者」→ Button「去发现」**minH 44** → Push Agent Explore
* **粉丝列表空**：**22pt Bold**「还没有粉丝」→ **17pt** 副文 — 无 CTA 或分享主页

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 0) {
    settingsBackHeader(height: 44, backTarget: 44)
    ScrollView(.horizontal) { PillTab(["粉丝","关注"], peek: 0.15) }
    if users.isEmpty {
        FollowEmptyState(type: selectedTab)
    } else {
        VStack(spacing: 0) {
            ForEach(users) { user in
                UserRow(avatar: 48, name: 17.semibold, follow: 44)
                Divider().foregroundStyle(#E5E5E5)
            }
        }
    }
}
.padding(.horizontal, 16)
.suppressTabBar()
```

## API

`GET /users/:id/followers` · `GET /users/:id/following`
