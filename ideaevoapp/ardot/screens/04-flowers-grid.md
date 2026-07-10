# S04F Flowers Grid v5

**Ardot frame:** `93:1671`  
**对应 iOS：** `FlowersGridView` · Idea Detail 鲜花入口  
**Marvel V4.0 评审：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S04F Flowers Grid · 收到的花 | 🎯 唯一核心任务：查看送花者并送出一朵花

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
┌──────────────────────────────────────┐ marginH 16
│ [AtlasPushNavBar H44] ‹ 收到的花 分享│ Hit 44
├──────────────────────────────────────┤
│ [ScrollView V-Stack gap 16]          │
│ [IdeaContextBar R16 - context only] │
│ ┌─ Summary Card R16 ──────────────┐ │
│ │ ✿ 共 N 朵 17pt Semibold         │ │
│ │ [H-Scroll avatar stack peek 15%]│ │ NOT 4-col Grid
│ └──────────────────────────────────┘ │
│ Text 15pt Semibold「送花记录」      │
│ [V-Stack gap 10]                     │
│   FlowerContributorRow × N           │ each row single surface
│   (Avatar36 name 15pt meta 13pt)   │
│ [OutlineButton 送一朵花 minH 44]     │
├──────────────────────────────────────┤
│ [EngagementBar H72 ✿ highlight]     │
└──────────────────────────────────────┘
```

#### 2. 元素样式、字阶与 Token 约束

* **排版**：Nav 标题 **17pt SemiBold** / 汇总 **17pt Semibold** / 姓名 **15pt Semibold** / 日期 **13pt #999**
* **间距容器**：`page-x` 16 / Summary **r16 p16** / ContributorRow **r16** 或 flat row + **Divider 1px**
* **触控热区**：Nav **44×44** / CTA **44×44** / Engagement **44×44**

#### 3. 上下文状态机

* `[Idle]` → EngagementBar ✿ 列 `accent-fork` 高亮
* `[Tap 送花]` → API POST；刷新列表（**V-Stack** 追加行，非 Grid 重绘）
* `[Tap 💬 on Engagement]` → Push Comments

#### 4. 物理微动效

* Push 入/出：**parallax 35%**
* 送花成功：Toast + 行插入动画 translateY 8px spring

#### 5. 空状态

* 无送花者：Summary 内 Text **15pt #666**「还没有人送花，成为第一个吧」— **禁止** 空 Grid 占位卡

#### 6. 伪代码

```swift
ScrollView {
    VStack(spacing: 16) {
        IdeaContextBar()
        Card(radius: 16) {
            Text("共收到 \(n) 朵花").font(.system(size: 17, weight: .semibold))
            ScrollView(.horizontal) {
                HStack(spacing: -10) { avatars }.padding(.trailing, peek15)
            }
        }
        ForEach(donors) { FlowerContributorRow($0) } // V-Stack ONLY
        OutlineButton("送一朵花", minHeight: 44)
    }.padding(.horizontal, 16)
}
.safeAreaInset { EngagementBar(highlightFlowers: true, hit: 44) }
```

---

## 结构（Ardot 组件 · 修订）

| # | 组件 | 规格 |
|---|------|------|
| 0 | `C/AtlasPushNavBar` | ‹ · 标题「收到的花」· 分享 Text · **Hit 44** |
| 1 | `C/IdeaContextBar` | Avatar **40** + slug **15pt** + subtitle **15pt #666** · tint |
| 2 | **汇总区** | 单卡 r16 · 数字 **17pt** + **H-Scroll** 头像叠层 peek **15%** |
| 3 | ~~送花者 8 格网格~~ | **已废弃** → 改用 **H-Scroll 快速预览** 或仅 V-Stack 列表 |
| 4 | `C/FlowerContributorRow` × N | Avatar **36** · 姓名 **15pt** ·「送了一朵花 · 日期」**13pt** · ✿ 计数 |
| 5 | CTA | Outline「送一朵花」**minH 44** |
| 6 | `C/EngagementBar` | h72 · ✿ 高亮 `accent-fork` |

## 布局硬规则

- **禁止** `LazyVGrid` / 多行多列头像墙
- **禁止** Summary Card 内再嵌 Contributor Card — 列表行用 **V-Stack + Divider** 或独立 flat row
- Section 方向：**V-Stack**（列表）；头像预览：**H-Scroll**（单行）

## API

`GET /ideas/:id/flowers` · `POST /ideas/:id/flowers`
