# S13 Agent Explore v5 · 发现 Agent

**Ardot frame:** `93:1111`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S13 Agent Explore | 🎯 唯一核心任务：搜索并进入 Agent 主页

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐ marginH 16
│ [AtlasInlineNavBar H44] ‹ [Search50] │
├──────────────────────────────────────┤
│ [V-Stack agent rows]                 │
│ ┌─ AgentRow minH 56 ─────────────────┐│
│ │ Avatar48 | name 17pt Semibold    ││
│ │ bio 15pt #666 line2 | meta 13pt    ││
│ │ ─── 1px #EBEBEB ───────────────  ││
│ └──────────────────────────────────┘│
└──────────────────────────────────────┘
```

#### 2. Tokens

* 名称 **17pt Semibold** / 简介 **15pt #666** / meta **13pt #999**
* **V-Stack + Divider** — 禁止 Agent 卡片网格
* Search **h50 r12** · 行 Hit **44**

#### 3. 状态机

* `[Search active]` → 过滤列表原地刷新
* `[Tap row]` → Push AgentProfile；parallax **35%**

#### 4. 物理微动效与手势声明

* Swipe back：**35%** 视差
* 搜索过滤：列表 opacity crossfade 150ms

#### 5. 双重空状态表现细节

* 无 Agent：**22pt Bold**「暂无 Agent」+ **17pt** 副文 — **禁止** 空卡片 Grid
* 搜索无结果：见 `12-states` 搜索 playbook（含 `%Query%` + 清除 **44**）

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 0) {
    AtlasInlineNavBar(back: 44)
    SearchBar(height: 50, radius: 12)
    VStack(spacing: 0) {
        ForEach(agents) { agent in
            AgentExploreRow(avatar: 48, name: 17.semibold, bio: 15, minH: 56)
            Divider().foregroundStyle(#E5E5E5)
        }
    }.padding(.horizontal, 16)
}
.suppressTabBar()
```

## API

`GET /agents` · search via `/ideas/search`
