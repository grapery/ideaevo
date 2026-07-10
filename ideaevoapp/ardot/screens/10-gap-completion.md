# Row 10 · iOS 缺口补全 · Marvel V4.0

**y=8036** · 对齐 Swift 已有、设计稿缺失的页面  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 模块：Gap Completion | 🎯 任务：补齐 iOS 已有但画板缺失的屏幕规格

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

**缺口 Sheet 通用模板**
```
[Root scale 0.95 dim 0.4]
┌─ Sheet R20 top ──────────────────────┐
│ [Handle 40×4 r2]                     │
│ [TitleRow 17pt Bold + X Hit44]       │
│ [Field h50 r12 17pt]                 │
│ [Primary minH 44]                    │
└──────────────────────────────────────┘
```

**缺口列表页通用**
```
[settingsBackHeader H44]
[V-Stack rows minH 56 + Divider #E5E5E5]
```

## 页面清单

| ID | Frame | 名称 | V4.0 要点 |
|----|-------|------|-----------|
| S08A | `93:1951` | Activity Full | 筛选 **H-Scroll**；统计 **V-Stack** |
| S06RN | `93:1994` | 重命名 Sheet | Handle **40×4** · Field **17pt h50** |
| S06DL | `93:2003` | 删除对话 Dialog | 按钮 **minH 44** · dim **0.4** |
| S01V | `93:2012` | 验证邮箱 Sheet | Sheet D 标准结构 |
| S01RL | `93:2020` | 重置密码 Sheet | Field **17pt** · Primary **44** |
| S11WX | `93:2031` | 微信绑手机 | 同 S11PH |
| S04CTA | `93:2044` | Idea Chat CTA | 单卡 **minH 44** · 见 `03-chat.md` |
| S04SIM | `93:2052` | 相似警告 | **V-Stack** · 见 `04p-similar-ideas.md` |
| S09M | `93:2063` | User Action Menu | Sheet · 行 **minH 44** |
| S14AK | `93:2074` | API Key Sheet | 警告卡 **#FFF8E1** 单卡 |
| S00L | `93:2084` | Bootstrap Loading | 全屏 · 无假卡片 |
| S08NE | `93:2088` | 通知空 | `12-states` |
| S05E | `93:2096` | 评论空 | ContextBar + 文案 **17pt** |
| S11BL | `93:2108` | 黑名单 | **V-Stack** 用户行 + 解除 **44** |

## S08A Activity Full

- Segmented + 搜索 **h50** + 筛选 Chips **H-Scroll peek 15%**
- 统计行 **17pt** / 排行卡 **单卡 r16** — 禁嵌套
- 底部 **PillTabBar** Hit **44**

## Sheet 通用（所有缺口 Sheet）

```
Handle 40×4 → TitleRow 17pt Bold → Content V-Stack
Root: scale 0.95 + dim 0.4
```

## UGC 扩展

```
用户主页 ⋯ → S09M (Sheet, rows minH 44)
  ├─ 分享
  ├─ 举报 → S12 Report
  └─ 拉黑 → S12 Block Dialog

设置 → 黑名单 → S11BL (V-Stack)
```

#### 3. 上下文状态机切换逻辑

* `[Sheet 缺口屏]` → Handle + TitleRow · 根 **scale 0.95 dim 0.4**
* `[列表缺口屏]` → settingsBackHeader + **V-Stack** · **suppressTabBar**
* `[Bootstrap S00L]` → 全屏 loading · **禁止** 假卡片 skeleton 墙

#### 4. 物理微动效 · 5. 空状态 · 6. Swift

* 动效：Sheet zoom · Push parallax **35%**
* 空态：各屏引用 `12-states.md`（S08NE / S05E / S14BE 等）
* 伪代码：见 `12-popups.md` Sheet D 模板 + 各子 spec

```swift
// 缺口 Sheet 通用
.sheet {
    VStack {
        HandleBar(40, 4)
        TitleRow(close: 44, title: 17.bold)
        contentVStack
        PrimaryButton(minH: 44)
    }
}
// 缺口列表
VStack(spacing: 0) {
    ForEach(rows) { Row(minH: 56); Divider().foregroundStyle(#E5E5E5) }
}
```
