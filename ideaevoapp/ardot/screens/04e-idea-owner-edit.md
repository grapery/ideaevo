# S04E Idea Owner Edit v5 · Owner 编辑

**Ardot frame:** `93:1422` · **版本：** `93:1590`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S04E Owner Edit | 🎯 唯一核心任务：修改 Idea 仓库元数据并保存

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐ marginH 16
│ [settingsBackHeader H44] ‹ 编辑想法    │
├──────────────────────────────────────┤
│ [V-Stack gap 16]                     │
│ Eyebrow 13pt #999 OWNER EDIT         │
│ [IdeaPublishIdentity Edit R16]       │
│ [Section 描述 - single card]         │
│   Markdown editor 17pt               │
│   changelog field 17pt               │
│ [Section 实现信息 - single card]     │
│   rows + Divider                     │
│ [版本预览 rows + Divider]            │
│ [Primary 保存 minH 44 teal]          │
│ [Destructive 埋葬 minH 44]           │
└──────────────────────────────────────┘
```

#### 2. Tokens · 3. 状态机

* 输入 **17pt** / Eyebrow **13pt** / 保存 **17pt Semibold minH 44**
* **单卡分区 + Divider** — 禁止描述卡内再套实现卡
* `[Editing]` → Tab hidden · `[保存]` → API · `[埋葬]` → Sheet **40×4 handle zoom 95%**

#### 4. 物理微动效与手势声明

* Push/Pop：**parallax 35%**
* 埋葬 Sheet：**scale 0.95 + dim 0.4**

#### 5. 双重空状态表现细节

* N/A — Owner 编辑无列表空态

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 0) {
    settingsBackHeader(height: 44)
    ScrollView {
        VStack(spacing: 16) {
            Text("OWNER EDIT").font(.caption13)
            IdeaPublishIdentity(edit: true)
            Card(radius: 16) {
                VStack(spacing: 0) {
                    MarkdownEditor(font: 17)
                    Divider().foregroundStyle(#E5E5E5)
                    TextField("changelog", font: 17)
                }
            }
            MetaSectionCard(rows: metaRows) // single card + Divider
            PrimaryButton("保存", minH: 44)
            DestructiveButton("埋葬", minH: 44)
        }.padding(.horizontal, 16)
    }
}
.suppressTabBar()
```

## 版本对比 S04V

- Segment **H-Scroll** pills peek 15%
- Diff **V-Stack** 行 **17pt** — 删除红 / 新增绿

## API

`PATCH /ideas/:id/description` · `PATCH /ideas/:id/meta` · `GET /ideas/:id/versions`
