# S04 Publish Idea v5 · 发布仓库

**Ardot frame:** `93:1123` · **相似：** `93:2052`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S04 Publish | 🎯 唯一核心任务：创建新 Idea 仓库并提交

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐ marginH 16
│ [settingsBackHeader H44] ‹ 发布想法    │
├──────────────────────────────────────┤
│ [ScrollView V-Stack gap 16]          │
│ ┌─ IdeaPublishIdentity R16 ────────┐ │
│ │ Avatar56 tap upload              │ │
│ │ slug preview 15pt                │ │
│ │ tint band                        │ │
│ └──────────────────────────────────┘ │
│ Field slug/title 17pt h50            │
│ Field description 17pt multiline     │
│ Agent picker row minH 44             │
│ [Similar warning V-Stack rows]       │ Divider per row, NO nested cards
│ [Primary 发布 minH 44]               │
└──────────────────────────────────────┘
```

#### 2. Tokens

* 标签 **15pt #666** / 输入 **17pt** / 按钮 **17pt Semibold minH 44**
* 单页 **V-Stack**；相似 Idea 用 `C/IdeaSimilarRow` **列表 + Divider**

#### 3. 状态机

* `[Editing]` → **隐藏 Tab Bar**；仅 Back + 发布
* `[Similar detected]` → 警告区 **V-Stack** 展开（非 Grid）
* `[Submit]` → loading on Primary

#### 4. Sheet 相似详情

* 若全屏列表：Push；若 Sheet：**Handle 40×4** + **zoom 95% dim 0.4**

#### 5. 双重空状态表现细节

* N/A — 发布表单无列表空态
* 相似检测零结果：不展示警告区

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 0) {
    settingsBackHeader(height: 44, back: 44)
    ScrollView {
        VStack(spacing: 16) {
            IdeaPublishIdentity(avatar: 56, slug: 15.semibold)
            TextField("标题", font: .body17).frame(height: 50)
            TextEditor(font: .body17)
            AgentPickerRow(minH: 44)
            if !similar.isEmpty {
                VStack(spacing: 0) {
                    ForEach(similar) { IdeaSimilarRow($0) }
                    Divider().foregroundStyle(#E5E5E5)
                }
            }
            PrimaryButton("发布", minH: 44)
        }.padding(.horizontal, 16)
    }
}
.suppressTabBar()
```

## `C/IdeaPublishIdentity`

| 元素 | 规格 |
|------|------|
| 头像 | **56** · tap upload · DiceBear fallback |
| Slug | **15pt Semibold** 实时预览 |
| Tint | 用户主色 @12% |

## API

`POST /ideas` · `POST /ideas/similar-check`
