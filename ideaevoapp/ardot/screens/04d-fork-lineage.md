# S04D Fork Lineage v5 · Branch Tree

**Ardot frame:** `93:1136`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S04D Fork Lineage | 🎯 唯一核心任务：沿 Fork 谱系浏览并打开子 Idea

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐ marginH 16
│ [settingsBackHeader H44] ‹ Fork 谱系  │
├──────────────────────────────────────┤
│ [ScrollView V-Stack gap 12]          │
│ ┌─ main node Card R16 tint ────────┐ │
│ │ Avatar40 | main·slug 15pt       │ │
│ │ meta 13pt stats                  │ │
│ └──────────────────────────────────┘ │
│   │ indent 16                        │
│   ├─ BranchNode row minH 44         │
│   │  Avatar32 slug15 meta13         │
│   ├─ Divider                        │
│   ├─ BranchNode child               │
│   └─ ...                            │  V-Stack tree ONLY
└──────────────────────────────────────┘
```

#### 2. Tokens

* main 标签 **15pt Semibold** / 节点标题 **17pt** / meta **13pt #999**
* 树形 **V-Stack + 左缩进线** — **禁止** 2D 图谱 Grid
* 节点 Hit **minH 44**

#### 3. 状态机

* `[Idle]` → 树展开 **V-Stack**
* `[Tap node]` → Push IdeaDetail 或 inline expand（仅垂直，非横向网）

#### 4. 物理微动效与手势声明

* Push/Pop：**parallax 35%**
* 节点展开：height spring 200ms（仅 V-Stack 子节点）

#### 5. 双重空状态表现细节

* 无 Fork 子节点：主节点卡下 Text **15pt #666**「暂无 Fork 分支」— **禁止** 空树 Grid 占位

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 0) {
    settingsBackHeader(height: 44)
    ScrollView {
        VStack(spacing: 12) {
            MainNodeCard(radius: 16, avatar: 40)
            VStack(spacing: 0) {
                ForEach(branches) { node in
                    BranchNode(indent: node.depth * 16, minH: 44)
                    Divider().foregroundStyle(#E5E5E5)
                }
            }
        }.padding(.horizontal, 16)
    }
}
// NO graph layout / NO LazyVGrid
```

## main 节点

- Tint 卡 **r16** + `C/IdeaAvatar` **40**
- `main · smart-home-energy` **15pt**
- meta **13pt** stats

## `C/BranchNode`

- Avatar **32** + fork slug **15pt**
- 文案 **17pt** / meta **13pt**
- 子 branch：**V-Stack** 向下，橙色 `branch` 标签 **13pt**

## API

`GET /ideas/:id/fork-children` · fork chain
