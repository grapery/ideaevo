---
name: marvel-art
description: >-
  Mobile UI Compiler V4.0 — pixel-level mobile UI/UX compiler that rejects abstract
  aesthetics. Outputs concrete canvas blueprints, state-machine matrices, design tokens
  (17pt body, 22pt title, 44pt touch targets), 5 layout paradigms, 1D flow, card
  flattening, bottom sheets, parallax swipe-back (35%), sheet zoom (95% + dim 0.4),
  long-press blur (20px) + scale (1.05x), and dual empty-state playbooks. Use when
  designing/reviewing mobile screens, writing UI specs, SwiftUI/UIKit, ASCII wireframes,
  or when the user mentions marvel-art, mobile UI compiler, or micro-interaction physics.
---

# Marvel Art · Mobile UI Compiler V4.0

**Role:** 移动端 UI/UX 像素级硬核编译器。彻底摒弃感性、抽象美学描述。将业务需求无损翻译为：**具象画布蓝图**、**确定性状态机矩阵**、**可落地微交互物理参数**。

**When to apply:** 设计/评审移动端界面、输出 handoff 规格、实现 SwiftUI/UIKit、审计布局与动效合规。

## Compiler workflow

1. 声明 **单屏单任务**（唯一核心用户行为）。
2. 选择 **五大布局范式** 组合（禁止发明模糊结构）。
3. 嵌套 **Design Tokens**（字阶、间距、圆角、热区）。
4. 每个 Section 二选一：`[V-Stack]` 或 `[H-Scroll]`（H-Scroll 右侧露 15% 暗示可滑）。
5. **卡片去嵌套**：大卡片内只用 `1px #E5E5E5` 分割线或 `8–12px` 留白。
6. 写出 **状态机切换矩阵**（Idle → Editing → Selection）。
7. 声明 **手势物理参数**（数值必须具体）。
8. 定义 **双重空状态**（首次登录 vs 搜索无结果）。
9. 按 [输出蓝图蓝本](#输出蓝图蓝本-mandatory) 输出，含 **ASCII Wireframe**。

## 🛑 消灭抽象描述（强制对照）

| ❌ 严禁 | ✅ V4.0 强制声明 |
|--------|------------------|
| “清爽的导航栏” | `[HeaderBar: Height 44px, LeftAction(Icon: Back), CenterTitle(17pt Bold), RightAction(Icon: Share, TouchTarget: 44x44px)]` |
| “卡片展示信息，排版美观” | `[Card: Radius 16px, Padding 16px, MarginHorizontal 16px, Background #FFFFFF, Border None]` |
| “精美的搜索无结果提示” | `[EmptyStateView: CenterVStack -> Image(120x120) -> Spacer(12) -> Text("未找到与'%Query%'匹配的内容", 15pt, #666) -> Spacer(16) -> Button("清除搜索条件", 17pt, Primary, Target 44x44)]` |

评审时若发现左侧表述，**必须改写为右侧具象声明**。

## Design tokens（硬编码）

### Touch targets

- 所有可点击元素 **≥ 44×44 px/pt**
- 图标 24px 时：声明 **外围 10px 透明 Padding**

### Typography（移动端字阶反转）

| Token | Spec |
|-------|------|
| Large Title | 34pt Bold #111111 |
| Title | 22pt Bold #111111 |
| Body | 17pt Regular #222222 |
| Subheadline | 15pt Regular #666666 |
| Caption | 13pt Regular #999999 |

### Spacing & radius

| Token | Value |
|-------|-------|
| Page padding | 16px 固定 |
| Card radius | 16px |
| Widget radius | 12px 或 Capsule |
| Divider | 1px #E5E5E5 |
| Inner whitespace | 8px 或 12px（替代内嵌卡片） |

## 五大布局范式（仅可组合此五种）

### 1. 两极化全局导航

**方案 A · 悬浮底栏**
- 底部或距底 **12px** 悬浮
- Tab **3–4** 个（上限 **5**）
- 含 `Center Breaking Action`（如 `+`，热区 **56×56px**）

**方案 B · Notion 式主页**（功能过多时）
```
[Recent Header: 15pt Caption]
-> [H-Scroll 最近记录卡片流]
-> [右侧 Action Buttons & Counts]
-> [Search Bar Height 50px Radius 12px] 或全局主操作
```

### 2. 一维延展约束

Section 内 **禁止 2D 网格**。二选一：
- `[V-Stack]`：宽满屏，垂直延伸
- `[H-Scroll]`：高固定，**右侧露 15%** 卡片宽度

### 3. 卡片去嵌套化

- ❌ `[大卡片 [小卡片A] [小卡片B]]`
- ✅ `[大卡片 Radius 16px -> 组件1 -> Divider 1px #E5E5E5 -> 组件2]`

### 4. 单屏单任务 + Bottom Sheet

- 详情页 **禁止**「猜你喜欢」「推荐模板」「历史记录」等噪音
- Sheet 标准结构：
  `[Handle 40×4px 圆角2 居中] -> Spacer(8) -> [Title 17pt Bold + X + Check] -> Spacer(12) -> [内容 V-Stack/H-Scroll]`

### 5. 上下文动态操作栏

见状态机矩阵。

## 状态机切换矩阵

| 状态 | UI |
|------|-----|
| **Idle 浏览** | 显示 `[Floating Bottom Bar]` |
| **进入编辑** | **立即隐藏** Bottom Bar → 键盘上方/底部 `[Contextual Tool Bar Height 48px]` |
| **多选/选模板** | 隐藏干扰元素，仅保留 `[Check]` + `[X]` |

必须在规格中写出触发行为与元素显隐。

## 手势物理引擎（数值必填）

| 手势 | 物理参数 |
|------|----------|
| **Swipe Right 返回** | 当前页位移 **100%** 滑出；底层页同步 **+35%** 水平位移（Parallax） |
| **Long Press** | 背景 **Blur 20px** + 卡片 **Scale 1.05x** + 浮动菜单 `[Radius 12px, 17pt Regular]` |
| **Bottom Sheet 打开** | 背景 **Zoom Out 95%** + **Dim Opacity 0.4**；关闭反向恢复 |
| **Swipe Up from Bottom Bar** | 可选：从底栏上拉唤起全局搜索 |

## 双重空状态

**首次登录：** 禁止空容器卡片；全屏插画 + `[Popover 指针]` **唯一指向** 全局 `(+)` Action。

**搜索无结果：**
```
[插画] -> Text("没有找到与「词」匹配的数据", 15pt, #666)
-> [拼写纠错/相似词 H-Scroll 或 V-Stack]
-> Button("一键清除搜索条件", 17pt, Active, Target 44x44)
```

## Review checklist

- [ ] 无抽象废话；全部具象 Token 声明
- [ ] 单屏单任务
- [ ] Body 17pt / Title 22pt / 完整字阶
- [ ] Page padding 16px；Card radius 16px
- [ ] 无嵌套卡片；Divider 替代
- [ ] Section 仅 V-Stack 或 H-Scroll（H-Scroll 露 15%）
- [ ] Bottom bar 3–4 项；热区 ≥44pt；Center Action 56×56
- [ ] 状态机矩阵已写
- [ ] 动效：35% parallax / 95% zoom + dim 0.4 / blur 20px + 1.05x
- [ ] 双重空状态已区分
- [ ] 含 ASCII Wireframe

## 输出蓝图蓝本 (mandatory)

```markdown
### 📱 界面：[精确命名] | 🎯 唯一核心任务：[单屏单任务]

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)
[ASCII 框线图：排布、嵌套、Padding 边界]

#### 2. 元素样式、字阶与 Token 约束 (Tokens Setup)
* **排版**：Large Title / Title / Body / Subheadline / Caption — 逐项列 pt + color
* **间距容器**：Page 16px / Card 16px radius / 内部 1px #E5E5E5
* **触控热区**：每项声明 44x44 或更大

#### 3. 上下文状态机切换逻辑 (Contextual Matrix)
* [Idle] -> ...
* [Editing/Active] -> 隐藏 [...] -> 唤起 [...]

#### 4. 物理微动效与手势声明 (Micro-Interactions)
* [35% 右滑视差] / [长按 Blur 20px + Scale 1.05x] / [Sheet Zoom 95% + Dim 0.4]

#### 5. 双重空状态表现细节 (Empty States)
* 初次登录：...
* 搜索无结果：...

#### 6. 声明式 UI 架构伪代码
```swift
// V-Stack / H-Scroll only; no nested cards
```
```

## SwiftUI patterns

**✅ Allowed**

```swift
VStack(spacing: 0) {
    HeaderBar(height: 44, left: .back, center: Title(17, .bold), right: .share, target: 44)
    ScrollView {
        VStack(spacing: 12) {
            Card(radius: 16, padding: 16, marginH: 16) {
                VStack(spacing: 0) {
                    RowA(font: .body17)
                    Divider().foregroundStyle(Color(hex: 0xE5E5E5))
                    RowB(font: .body17)
                }
            }
            ScrollView(.horizontal) {
                HStack(spacing: 12) { /* peek 15% */ }
            }
        }
    }
    FloatingBottomBar(tabs: 3...4, centerAction: 56, minTarget: 44)
}
```

**❌ Forbidden**

```swift
Card { Card { } }           // double nesting
LazyVGrid { }                 // 2D grid in section
// "现代简洁的导航"            // abstract prose
```

## Relationship to other skills

- **dev-ui** — liquid glass, lens chrome, morphing（AI 浮动材质）
- **marvel-art V4.0** — 字阶、Token、1D 流、状态机、手势物理、ASCII 蓝图、消灭抽象描述

## Additional resources

- V4.0 完整规范原文：[reference.md](reference.md)
- V4.0 输出示例：[examples.md](examples.md)
