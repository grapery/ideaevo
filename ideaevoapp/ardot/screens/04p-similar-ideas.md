# S04P Similar Ideas v5 · 相似检测

**Ardot frame:** `93:2052`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S04P Similar Ideas | 🎯 唯一核心任务：确认是否仍要发布（或查看相似仓库）

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
┌──────────────────────────────────────┐ marginH 16
│ [WarningBanner R16 #FFF8E1 minH 44]  │
│   Text 17pt Semibold「发现相似想法」  │
│   Sub 15pt #666 说明文案              │
├──────────────────────────────────────┤
│ [V-Stack similar list gap 0]         │
│ IdeaSimilarRow minH 56               │
│   Avatar32 | slug15 | sim 13pt | 查看44
│ ─── Divider #E5E5E5 ───              │
│ (repeat)                             │
├──────────────────────────────────────┤
│ [Primary 仍要发布 minH 44]           │
│ [Secondary 取消 minH 44]             │
└──────────────────────────────────────┘
```

#### 2. 元素样式、字阶与 Token 约束

* **排版**：警告标题 **17pt Semibold** / 说明 **15pt #666** / 行标题 **17pt** / slug **15pt** / 相似度 **13pt #999**
* **间距容器**：`page-x` **16px** · 列表 **V-Stack only** — **禁止 2D Grid**
* **触控热区**：「查看」**44×44** · 主/次按钮 **minH 44**

#### 3. 上下文状态机切换逻辑

* `[Idle · 警告展示]` → Banner + 相似列表 `V-Stack` + 底部双按钮
* `[Tap 查看]` → Push Idea Detail · **suppressTabBar** · parallax **35%**
* `[Tap 仍要发布]` → dismiss 警告 → 继续发布流程
* `[Tap 取消]` → 返回编辑页

#### 4. 物理微动效与手势声明

* 列表展开：height **spring** — 非 Grid 重排
* Push 详情：**parallax 35%**
* 若以 Sheet 呈现：根 **scale 0.95 + dim 0.4**

#### 5. 双重空状态表现细节

* **无相似项**：不展示本屏 — 直接继续发布
* **搜索无结果**：不适用

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 12) {
    WarningBanner(radius: 16, fill: #FFF8E1, minH: 44) {
        Text("发现相似想法").font(.system(size: 17, weight: .semibold))
        Text(subtitle).font(.system(size: 15)).foregroundStyle(#666)
    }
    VStack(spacing: 0) {
        ForEach(similar) { idea in
            IdeaSimilarRow(avatar: 32, viewTarget: 44)
            Divider().foregroundStyle(#E5E5E5)
        }
    }
    PrimaryButton("仍要发布", minH: 44)
    SecondaryButton("取消", minH: 44)
}
.padding(.horizontal, 16)
// NO LazyVGrid
```

---

## 组件

| 组件 | 规格 |
|------|------|
| `C/IdeaSimilarRow` | Avatar **32** + slug **15pt** + 相似度 **13pt** + 查看 Hit **44** |
| `C/IdeaSearchCard` | 完整行 **17pt** 标题 — 列表 **V-Stack only** |

每条：头像、slug、创建者、时间、相似度 — **禁止** 嵌套双卡。

## API

`POST /ideas/similar-check`
