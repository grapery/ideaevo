# S05 Comments v5 · Idea 上下文 + 讨论

**Ardot frame:** `93:991`  
**空态：** `93:2096`  
**Marvel V4.0 评审：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S05 Comments | 🎯 唯一核心任务：阅读讨论并发表一条评论

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
┌──────────────────────────────────────┐ marginH 16
│ [AtlasPushNavBar H44] ‹ 评论·N      │ Hit 44
├──────────────────────────────────────┤
│ [ScrollView V-Stack gap 16]          │
│ [IdeaContextBar R16]                 │
│ ┌─ CommentRow (flat, no inner card)─┐│
│ │ Avatar36  body 17pt  time 13pt    ││
│ │ ─── 1px #EBEBEB between rows ───  ││
│ └───────────────────────────────────┘│
├──────────────────────────────────────┤
│ [BottomInputBar H56 Field44 Send40]   │ Hit send 44
└──────────────────────────────────────┘
```

#### 2. 元素样式、字阶与 Token 约束

* **排版**：Nav「评论 · N」**17pt SemiBold** / 评论正文 **17pt Regular #222** / 时间 **13pt #999** / Context slug **15pt**
* **间距容器**：`page-x` 16 / ContextBar **r16** / 评论行间距 **12**；行间 **Divider 1px #EBEBEB**（非嵌套卡）
* **触控热区**：‹ **44×44** / 发送钮外框 **44×44**（visual 40 圆）

#### 3. 上下文状态机切换逻辑

* `[Idle · 浏览]` → `BottomInputBar` 显示（已登录）/ 登录条（未登录）；**Tab Bar 隐藏**
* `[Focus 输入框]` → 键盘升起；**保持** `BottomInputBar`；**禁止** 与 `EngagementBar` 叠放
* `[Reply 某条]` → 输入区上方 Reply 条 **15pt** + 取消 **44×44**
* `[未登录]` → 底栏替换为 Button「登录后评论」**minH 44**

#### 4. 物理微动效

* Push：**parallax 35%**
* 键盘：`scrollDismissesKeyboard(.interactively)`
* 发送成功：新评论行 fade + translateY 8px

#### 5. 双重空状态

* **无评论**：ContextBar 保留 + 空态插画区 → Text **17pt**「写下第一条评论」— **非** 空卡片列表
* 搜索无结果：N/A

#### 6. 伪代码

```swift
VStack(spacing: 0) {
    AtlasPushNavBar(title: "评论 · \(n)", hit: 44)
    ScrollView {
        LazyVStack(spacing: 16) {
            IdeaContextBar()
            ForEach(comments) { row
                commentRow.font(17)
                Divider().foregroundStyle(#E5E5E5)
            }
        }.padding(.horizontal, 16)
    }
    BottomInputBar(height: 56, fieldHeight: 44, sendHit: 44)
}
.suppressTabBar()
```

---

## 顶栏 · `C/AtlasPushNavBar`

- `[HeaderBar H44]` Left ‹ **Hit44** · Center「评论 · N」**17pt SemiBold** · Right Spacer **44×44** 对称

## Idea 上下文 · `C/IdeaContextBar`

| 元素 | 规格 |
|------|------|
| Tint 背景 | 创建者主色 @12% 渐变 |
| 头像 | **40** · slug **15pt Semibold** + subtitle **15pt #666** |
| 位置 | 列表顶部；随滚动（非 sticky 亦可） |

## 评论行

- Avatar **36** + 正文 **17pt Regular** + 时间 **13pt #999**
- **禁止** 每条评论再包一层完整 Card — 用 **Divider** 分隔

## API

`GET /ideas/:id/comments` · `POST /ideas/:id/comments`
