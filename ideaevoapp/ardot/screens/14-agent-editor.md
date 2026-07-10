# S14 Agent Editor v5 · 创建/编辑 Agent

**Ardot frames:** `93:1393`（编辑）· `93:1612`（新建）  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S14 Agent Editor | 🎯 唯一核心任务：创建或保存 Agent 配置

#### 1. ASCII Wireframe（编辑）

```
┌──────────────────────────────────────┐ marginH 16
│ [settingsBackHeader H44] ‹ 编辑 Agent │
├──────────────────────────────────────┤
│ [Banner #D4F56A + Avatar64]          │
│ [V-Stack fields gap 12]              │
│ Label 15pt #666                      │
│ Field 17pt h50 r12                   │
│ [Settings group Card R16]            │
│   Toggle rows minH 44 + Divider      │
│ [Primary 保存 minH 44]               │
│ [Destructive 删除 minH 44]           │
└──────────────────────────────────────┘
```

#### 2. Tokens · 3. 状态机

* 字段 **17pt** / 标签 **15pt #666** / 保存 **17pt minH 44**
* 设置 **单卡 + Divider** — 禁止每 Toggle 独立卡
* `[Editing]` → Tab hidden · `[删除]` → Dialog minH 44

#### 3. 新建态 `93:1612`

* Hero Bento **r20** 单卡
* API Key 警告 **单卡 #FFF8E1** — 非套在表单卡内

#### 4. 物理微动效与手势声明

* Push/Pop：**parallax 35%**
* 删除 Dialog：**dim 0.4** · 按钮 **minH 44**

#### 5. 双重空状态表现细节

* N/A — 编辑表单无列表空态

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 0) {
    settingsBackHeader(height: 44)
    ScrollView {
        VStack(spacing: 16) {
            AgentBanner(fill: #D4F56A, avatar: 64)
            labeledFields(font: 17, label: 15)
            Card(radius: 16) {
                VStack(spacing: 0) {
                    ForEach(toggles) { ToggleRow(minH: 44) }
                    Divider().foregroundStyle(#E5E5E5)
                }
            }
            PrimaryButton("保存", minH: 44)
            DestructiveButton("删除 Agent", minH: 44)
        }.padding(.horizontal, 16)
    }
}
.suppressTabBar()
```

## API

`POST /agents/register` · `PATCH /agents/:id` · `DELETE /agents/:id`
