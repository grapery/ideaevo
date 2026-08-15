# S12 States & Empty v5 · Marvel V4.0

**Ardot frames:** Row 5 · Master Board  
**Marvel V4.0 评审：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 模块：S12 States & Empty | 🎯 任务：为各主路径提供可区分的 Loading / Empty / Offline 规格

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

**双重空状态决策树**
```
有过滤条件? ──是──> [搜索无结果 playbook]
     │
     否
     └──> [首次/全局空 playbook]
            · 禁止空容器卡片墙
            · Popover 指向 (+) 仅首次引导场景
```

#### 3. 上下文状态机切换逻辑

* `[Idle · 有内容]` → 正常列表/Feed
* `[Empty · 首次]` → 全屏插画 + Popover 指向 Header `(+)` **56×56** — **禁止** 空容器卡墙
* `[Empty · 搜索无结果]` → `%Query%` + 建议词 **H-Scroll peek 15%** + 清除 **Hit 44**
* `[Loading]` → Skeleton · Tab Bar 保持可见
* `[Offline]` → 横幅 + 重试 **minH 44**

双重空状态 Playbook：**首次引导** vs **搜索/过滤无结果** — 结构不可混用。

---

## Loading Skeleton（首页）

对应 `HomeView` / `ActivityView.loadingSkeleton`

- 搜索栏占位 `#F5F5F5` · **h50** · r12
- Segment pill 占位
- 3 张 Idea 卡 skeleton · 白底 r16 · 内部 `#F5F5F5` 条 — **非** 嵌套卡
- Tab Bar 保持可见

---

## Empty · 广场首次（First-time · S02E `93:1305`）

**类型：** 首次登录 / 全局无内容 — **禁止** 展示空容器卡片墙

```
[Fullscreen V-Stack center]
-> 隐藏非必要 Feed 占位卡
-> Image(illustration, 120×120)
-> Spacer(12)
-> Text("广场还没有想法", 22pt Bold, #111)
-> Spacer(8)
-> Text("成为第一个发布创意的人", 17pt Regular, #222)
-> Spacer(24)
-> Button("发布想法", 17pt Semibold, minH 44, Primary #0A0A0A)
-> [Popover 指针] 唯一指向 Header (+) Hit 56×56
```

---

## Empty · 搜索无结果（No Results · S03E `93:1324`）

**类型：** 有过滤条件但零匹配 — **必须** 含纠错建议

```
[EmptyStateView center, marginH 16]
-> Image(placeholder, 120×120)
-> Spacer(12)
-> Text("没有找到与「%Query%」匹配的数据", 15pt Regular, #666666)
-> Spacer(12)
-> [H-Scroll suggestion chips peek 15%]  // 如：智能家居 / 家庭能源
-> Spacer(16)
-> Button("一键清除搜索条件", 17pt Semibold, Active, Target 44×44)
```

- **禁止** 仅写「试试其他关键词」而无 `%Query%` 与建议词
- 建议词来源：拼写纠错 / 热门标签 / 历史搜索

---

## Empty · 关注（S09CE `93:1335`）

```
-> Image 64×64 tint #FFF4A8
-> Text("还没有关注任何人", 22pt Bold)
-> Text("去发现有趣的创作者", 17pt Regular)
-> Button("去发现", minH 44) -> Push Agent Explore
```

---

## Empty · 我的 Agent（S14BE `93:1348`）

```
-> Image tint #D4F56A
-> Text("还没有 Agent", 22pt Bold)
-> Text("创建你的第一个 AI 助手", 17pt Regular)
-> Button("创建 Agent", minH 44)
```

---

## Empty · 评论（S05E `93:2096`）

- 保留 `IdeaContextBar`
- Text **17pt**「还没有评论」+ 副文 **15pt #666**
- 底栏 `BottomInputBar` 引导输入 — **非** 空 Comment 卡列表

---

## Empty · 动态（S08E `93:1646`）

- Header「协作」+ ToolbarFloat「全局」保留
- 空态 **V-Stack**：Text **22pt Bold** + 副文 **17pt**
- **禁止** 假事件卡片占位

---

## Offline Banner

对应 `AtlasOfflineBanner`

- 背景 `#FFF4A8` · r12 · 高 **44**
- 文案：**17pt Regular**「网络不可用，显示缓存内容」
- 右侧「重试」**15pt Semibold** · **Hit 44×44**

---

## 状态帧索引

| 状态 | Frame | ID |
|------|-------|-----|
| 首页 Loading | S02 Loading v5 | `93:1279` |
| 首页 Empty | S02 Empty v5 | `93:1305` |
| 首页 Offline | S02 Offline v5 | `93:1376` |
| 搜索无结果 | S03 Search Empty v5 | `93:1324` |
| 关注列表空 | S09C Following Empty v5 | `93:1335` |
| 我的 Agent 空 | S14B Agents Empty v5 | `93:1348` |
| 对话空态 | S06 Chat Empty v5 | `93:1556` |
| 关注需登录 | S08 Following Login v5 | `93:1567` |
| 动态空态 | S08 Activity Empty v5 | `93:1646` |
| 评论空 | S05 Comments Empty | `93:2096` |
| 通知空 | S08 Notifications Empty | `93:2088` |

---

#### 4. 物理微动效与手势声明

* Skeleton：shimmer opacity 0.4→1.0 1.2s loop
* 空态 CTA：button scale 0.98 on press
* Offline 重试：banner slide-down spring

#### 6. 声明式 UI 架构伪代码

```swift
enum EmptyPlaybook {
    case firstTime   // illustration + popover → (+)
    case noResults(query: String)  // %Query% + chips + clear 44
}

struct ScreenEmptyState: View {
    let playbook: EmptyPlaybook
    var body: some View {
        VStack(spacing: 12) {
            Image(illustration).frame(width: 120, height: 120)
            switch playbook {
            case .firstTime:
                Text(title).font(.system(size: 22, weight: .bold))
                Text(subtitle).font(.body17)
                Button(action: publish) { Text("发布想法") }.frame(minHeight: 44)
            case .noResults(let q):
                Text("没有找到与「\(q)」匹配的数据").font(.system(size: 15)).foregroundStyle(#666)
                ScrollView(.horizontal) { suggestionChips }
                Button("一键清除搜索条件") { clear() }.frame(minHeight: 44)
            }
        }
        // NO empty placeholder cards
    }
}
```
