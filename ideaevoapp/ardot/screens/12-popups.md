# S12 Popups & Sheets v5

**Ardot frames:** Row 4 · Master Board  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 模块：S12 Popups & Sheets | 🎯 唯一核心任务：在不离开主流程的前提下完成次要确认/输入

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

**Sheet D（标准）**
```
[Root scale 0.95 dim 0.4]
┌─ Sheet R20 top ──────────────────────┐
│ [Handle 40×4 r2 center]              │
│ Spacer(8)                            │
│ [TitleRow] X Hit44 | Title 17pt Bold | ✓ Hit44
│ Spacer(12)                           │
│ [Content V-Stack or H-Scroll]        │
│ [Primary minH 44] [Secondary minH 44]│
└──────────────────────────────────────┘
```

**Dialog（居中）**
```
[Dim 0.4 full screen]
┌─ Dialog 326×~240 R20 ───────────────┐
│ Title 17pt Bold                      │
│ Body 17pt Regular #222               │
│ [Destructive 44] [Cancel 44]         │
└──────────────────────────────────────┘
```

#### 2. 元素样式、字阶与 Token 约束

| Token | 值 |
|-------|-----|
| 遮罩 | `#0A0A0A` @ **40%**（dim **0.4**） |
| 背景联动 | 主内容 **scale 0.95** + dim **0.4** |
| Sheet 圆角 | 顶部 **20** |
| Dialog 圆角 | **20** |
| 内边距 | **16** |
| Handle | **40×4** · r2 · `#EBEBEB` |
| 主按钮 | 黑 pill **minH 44** · **17pt Semibold** |
| 次按钮 | 描边 pill **minH 44** |
| 破坏性 | `#FF3B30` · **minH 44** |

#### 3. 上下文状态机切换逻辑

* `[Idle · 主流程]` → 无 Overlay
* `[Sheet 次要任务]` → 隐藏 Tab Bar · 根 **scale 0.95 dim 0.4** · 仅 Sheet 可交互
* `[Dialog 确认]` → 全屏 dim · 居中 Dialog · 双按钮 **44**
* `[Dismiss]` → 反向恢复 scale 1.0 · dim 0

#### 4. 物理微动效与手势声明

* Sheet 拖拽：超过 50% 高度 dismiss · spring
* 打开/关闭：**zoom 95% ↔ 100%** + dim **0.4 ↔ 0**
* Toast：顶部滑入 48h · 3s 自动消失

#### 5. 双重空状态表现细节

* Sheet/Dialog 模块本身无空态
* 内容区空（如 Picker 无项）：**17pt** 居中文案 — **禁止** 嵌套空卡

#### 6. 声明式 UI 架构伪代码

```swift
ZStack {
    rootView.scaleEffect(sheetPresented ? 0.95 : 1.0)
    if sheetPresented { Color.black.opacity(0.4).ignoresSafeArea() }
    if sheetPresented {
        VStack {
            HandleBar(40, 4)
            TitleRow(close: 44, title: 17.bold)
            content // V-Stack or H-Scroll ONLY
            PrimaryButton(minH: 44)
        }
    }
}
```

---

| 类型 | Frame | ID |
|------|-------|-----|
| 登录拦截 Sheet | S12 Auth Sheet Zoom v5 | `93:1196` |
| Fork Sheet | S12 Fork Sheet Zoom v5 | `93:1206` |
| 埋葬 Sheet | S12 Bury Sheet Zoom v5 | `93:1221` |
| 注销 Dialog | S12 Delete Dialog v5 | `93:1233` |
| 删除 Agent Dialog | S12 Delete Agent Dialog v5 | `93:1603` |
| Phone 绑定 Sheet | S11 Phone Bind Sheet v5 | `93:1631` |
| Toast | S12 Toast v5 | `93:1317` |

## 通用规范

> 以下条目已并入上方 Marvel V4.0 六段式；保留速查。

| Token | 值 |
|-------|-----|
| 遮罩 | `#0A0A0A` @ **40%**（与 dim 0.4 等效） |
| 背景联动 | 主内容 **scale 0.95** + dim **opacity 0.4**（Sheet 打开时） |
| Sheet 圆角 | 顶部 `20` |
| Dialog 圆角 | `20` |
| 内边距 | `16` |
| 拖拽条 | **`40×4`** · r2 · `#EBEBEB` · 居中 |
| 主按钮 | 黑 pill **`minH 44`** · `#0A0A0A` fill · 字 **17pt Semibold** |
| 次按钮 | 描边 pill **`minH 44`** · `#EBEBEB` stroke |
| 破坏性 | `#FF3B30` fill · **minH 44** |

### Sheet 标准结构（Marvel V4.0）

```
[HandleBar 40×4 r2 center]
-> Spacer(8)
-> [TitleRow: X Hit44 | Title 17pt Bold | Check Hit44]
-> Spacer(12)
-> [Content: V-Stack or H-Scroll only]
```

打开时：下层页面 `scaleEffect(0.95)` + `Color.black.opacity(0.4)`；关闭反向。

## Auth Required Sheet

对应 iOS `AuthRequiredSheet` · `presentationDetents([.height(260)])`

- **标题：** 登录后继续
- **正文：** 浏览不受影响。登录后可送花、评论、关注与对话。
- **主 CTA：** 登录 → 打开 LoginView
- **次 CTA：** 先看看 → dismiss

## Fork Sheet

从 Idea Detail Engagement 栏触发。

- **标题：** Fork 这个想法
- **正文：** 基于原想法创建你的版本，保留溯源关系。
- **原想法卡：** `C/IdeaForkSource` — 头像 40 + slug + 创建者 · 创建时间 · ⑂ Fork 数 · tint 顶栏
- **输入：** 新想法标题（可选）
- **主 CTA：** 确认 Fork →
- **次 CTA：** 取消

## Bury Sheet

对应 `IdeaDetailView.buryReasonSheet` · `.height(280)`

- **标题：** 埋葬想法
- **正文：** 埋葬后想法将从搜索与推荐中移除。
- **输入：** 原因（必填）
- **主 CTA：** 确认埋葬
- **次 CTA：** 取消

## Delete Account Dialog

居中 Dialog · 326×240

- **标题：** 删除账号
- **正文：** 此操作不可撤销。你的 Agent、想法与对话记录将被永久删除。
- **主 CTA：** 确认删除（红 `#FF3B30`）
- **次 CTA：** 取消

## Delete Agent Dialog

居中 Dialog · 326×224

- **标题：** 删除 Agent？
- **正文：** 删除后无法恢复，该 Agent 发布的想法仍会保留。
- **主 CTA：** 删除（红）
- **次 CTA：** 取消

## Phone Bind Sheet

Sheet 高 ~380 · 从账户与安全弹出

- **标题：** 绑定手机号
- **说明：** 验证手机号用于账户安全与微信注销确认。
- **字段：** 手机号 · 验证码 + 获取验证码
- **主 CTA：** 完成绑定
- **关闭：** 右上角「关闭」

## Toast Banner

顶部浮动 · 距 safe area `60`

| 变体 | 背景 | 示例 |
|------|------|------|
| Success | `#0A0A0A` | Fork 成功 |
| Error | `#FF3B30` | 网络连接失败，请重试 |

- 高度 `48` · r12 · 左侧状态圆点（Success 用 Agent 绿 `#D4F56A`）

## Idea Action Menu (`93:1940`)

从 Idea Detail 更多菜单触发 · 左上角弹出。

- **`C/IdeaMenuHeader`** — 头像 28 + slug + 创建者 · ⑂
- 分享
- 举报（红）
- 拉黑发布者（红）
