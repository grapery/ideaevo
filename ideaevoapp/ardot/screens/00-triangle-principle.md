# User → Agent → Idea 三角原则

**组件：** `C/RelationshipTriangle` `93:747`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 原则：Relationship Triangle | 🎯 任务：首屏可见 User→Agent→Idea 关系

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
┌─ C/RelationshipTriangle R16 p12 ─────┐
│ [User #FFF4A8] → [Agent #D4F56A] → [Idea #B8F5EC] │
│  15pt name      15pt name         15pt name        │
│  13pt role      13pt role         13pt role       │
│  each cell minH 44                                │
└───────────────────────────────────────────────────┘
// Single card — NO wrap card
```

## 核心模型

```
     User (#FFF4A8)
      /         \
  Agent        Idea
(#D4F56A)   (#B8F5EC)
```

- **User** 拥有 Agent，创建 Idea
- **Agent** 桥梁；公开可浏览，私有对话不可见
- **Idea** 一等公民：状态 · 进度 · Fork 溯源

#### 3. 上下文状态机切换逻辑

* `[Idle · 展示]` → Full 或 Compact 三角 inline
* `[Tap User/Agent/Idea 节点]` → Push 对应 Profile · parallax **35%**

#### 4. 物理微动效与手势声明

* 节点 Tap → Push；parallax **35%**
* Compact 单行：**minH 44** 整行可点

## 视觉规则

| 实体 | 色 | 用于 |
|------|-----|------|
| User | `#FFF4A8` | Banner、关注空态 |
| Agent | `#D4F56A` | Agent Banner、Picker |
| Idea | `#B8F5EC` | Idea 卡、Fork Bento |

## 组件规格（V4.0）

| 变体 | 布局 | 字阶 | 热区 |
|------|------|------|------|
| **Full** | 三列 **H-Stack** 等宽 | 节点名 **15pt Semibold** / 角色 **13pt #999** | 每节点 **minH 44** |
| **Compact** | 单行缩略 | **15pt** | 整行 **44** |

- **禁止** 三角外再套卡片；三角本身为 **单卡 r16** 或 inline 区块
- 用于：Idea Detail · Agent Profile · User Profile（compact）

#### 5. 双重空状态表现细节

* N/A — 关系三角为信息组件，非独立列表屏

#### 6. 声明式 UI 架构伪代码

```swift
HStack(spacing: 8) {
    TriangleCell(entity: .user, fill: #FFF4A8, name: 15.semibold, minH: 44)
    Arrow()
    TriangleCell(entity: .agent, fill: #D4F56A, minH: 44)
    Arrow()
    TriangleCell(entity: .idea, fill: #B8F5EC, minH: 44)
}
.padding(12)
.cornerRadius(16)
// NO outer Card wrap
```
