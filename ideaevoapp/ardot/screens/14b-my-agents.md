# S14B My Agents v5 · 我的 Agent

**Ardot frame:** `93:1093`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S14B My Agents | 🎯 唯一核心任务：管理自己的 Agent 并创建/编辑

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
┌──────────────────────────────────────┐ marginH 16
│ [settingsBackHeader H44] ‹ 我的 Agent│
├──────────────────────────────────────┤
│ [V-Stack agent rows]                 │
│ row minH 56 accent-left 4px #D4F56A  │
│   Avatar40 | name 17pt Semibold      │
│   public/private 13pt | ideas 13pt   │
│ ─── Divider #E5E5E5 ───              │
│ (repeat)                             │
│ [FAB + 56×56] 右下角                  │
└──────────────────────────────────────┘
```

#### 2. 元素样式、字阶与 Token 约束

* **排版**：名称 **17pt Semibold** / meta **13pt #999** / 左条 **4px #D4F56A**
* **间距容器**：`page-x` **16px** · **V-Stack + Divider** — 单行列表，**非 Grid**
* **触控热区**：行整行可点 **minH 44** · 创建 **+ Hit 56×56**

#### 3. 上下文状态机切换逻辑

* `[Idle · 列表]` → `settingsBackHeader` + `V-Stack` + FAB **56×56**
* `[Tap 行]` → Push Agent Editor · **suppressTabBar**
* `[Tap +]` → Push Create Agent · 或 Sheet
* `[Editing · Agent Editor]` → 隐藏 FAB · 见 `14-agent-editor.md`

#### 4. 物理微动效与手势声明

* Swipe back：**35%** 视差
* FAB 出现：scale spring from 0.9
* 删除 Agent：Dialog **dim 0.4** · 按钮 **minH 44**

#### 5. 双重空状态表现细节

* **无 Agent**：见 `12-states.md` S14BE — Image tint `#D4F56A` → **22pt Bold**「还没有 Agent」→ **17pt**「创建你的第一个 AI 助手」→ Button「创建 Agent」**minH 44**
* **搜索无结果**：不适用

#### 6. 声明式 UI 架构伪代码

```swift
ZStack(alignment: .bottomTrailing) {
    VStack(spacing: 0) {
        settingsBackHeader(title: "我的 Agent", back: 44)
        if agents.isEmpty {
            MyAgentsEmptyState()
        } else {
            VStack(spacing: 0) {
                ForEach(agents) { agent in
                    AgentRow(accent: 4, minH: 56, font: 17.semibold)
                    Divider().foregroundStyle(#E5E5E5)
                }
            }
        }
    }
    CreateFAB(size: 56, hitTarget: 56)
}
.padding(.horizontal, 16)
.suppressTabBar()
```

## API

`GET /my/agents` · `GET /users/:id/agents`
