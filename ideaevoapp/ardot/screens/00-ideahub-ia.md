# S00 IdeaHub IA · GitHub for Ideas

**Ardot frame:** `129:2` · `S00 IdeaHub IA v5`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 原则：IdeaHub IA | 🎯 任务：GitHub 概念映射到移动端 1D 布局范式

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
GitHub Repo ──map──> S04 Idea Detail
  README      ──> Body 17pt V-Stack
  Fork tree   ──> S04D V-Stack BranchNode (NO Grid)
  Stars       ──> Flowers H-Scroll peek 15%
  Issues      ──> S05 flat rows + Divider
  Explore     ──> S02 Feed V-Stack IdeaCardHero
```

万叶是 **Idea 的 GitHub**：每个 Idea 是可 Fork、协作、演化的「仓库」。

## 核心映射

| GitHub | IdeaHub | 布局范式 (V4.0) |
|--------|---------|-----------------|
| Repository | **S04 Idea Detail** | IdentityHero + RepoTabs **H-Scroll** + V-Stack |
| README.md | 描述 + 实现进度 | Body **17pt** |
| Fork / Branch | S04D 谱系 | **V-Stack** 树，禁 Grid |
| Stars | 鲜花 ✿ | Flowers **H-Scroll** 预览 + V-Stack 列表 |
| Issues | S05 Comments | ContextBar + flat rows + Divider |
| Activity | S08 动态 | **V-Stack** 事件行 |
| Explore | S02 Home | IdeaCardHero + Feed **V-Stack** |

## 设计优先级

1. **P1 · S04** (`93:759`) — `C/IdeaIdentityHero` + RepoTabs + EngagementBar
2. **P2 · S02** (`93:927`) — `C/IdeaCardHero` 发现流
3. **P3 · S08** (`93:952`) — `C/ActivityRepoEvent`
4. **P4 · S04D** (`93:1136`) — `C/BranchNode` V-Stack
5. **P5 · S03** (`93:1170`) — `C/IdeaSearchCard` 列表
6. **P6 · S08N** (`93:972`) — 通知 flat row
7. **P7 · S04 Publish** (`93:1123`) — `C/IdeaPublishIdentity`
8. **P8 · S03 Chat** (`93:904`) — `C/IdeaChatCard`
9. **P9 · Fork Sheet** (`93:1206`) — `C/IdeaForkSource` + Handle **40×4**
10. **P10 · S04E** (`93:1422`) — Owner Edit
11. **P11 · S10** (`93:868`) — `C/IdeaCardCompact` **V-Stack**
12. **P12 · S04F** (`93:1671`) — Flowers 去 Grid

## Marvel V4.0 全局约束

| 规则 | 应用 |
|------|------|
| Body **17pt** | README、评论、列表正文 |
| Title **22pt** | Tab 根页、详情标题 |
| Hit **44×44** | Nav、Engagement、菜单行 |
| 单卡 + Divider | 列表、设置、通知 |
| 禁嵌套卡 | Fork Bento、Flowers、Profile 菜单 |
| Sheet Zoom | Fork / Auth / Picker：**scale 0.95 dim 0.4** |

## Idea 身份原则

→ [`00-idea-identity.md`](./00-idea-identity.md)

## 组件索引

| 组件 | Frame | 流向 |
|------|-------|------|
| `C/IdeaIdentityHero` | `129:18` | 单卡 tint |
| `C/IdeaCardHero` | `129:41` | Feed 96h |
| `C/RepoTabs` | Detail | H-Scroll peek 15% |
| `C/IdeaSearchCard` | Search | V-Stack item |
| `C/ActivityRepoEvent` | `93:957` | V-Stack + Divider |
| `C/BranchNode` | Lineage | V-Stack indent |
| `C/IdeaContextBar` | Comments/Flowers | 单卡 r16 |
| `C/IdeaCardCompact` | Profile | V-Stack |
| `C/FlowerContributorRow` | Flowers | V-Stack 行 |

#### 3. 上下文状态机切换逻辑

* 各屏状态机见对应屏幕 spec；IA 层统一：**Tab 根** → **Push** → **Sheet** 互斥（见 `00-navigation-ia.md`）

#### 4. 物理微动效与手势声明

* 全局：Push **parallax 35%** · Sheet **zoom 0.95 dim 0.4**

#### 5. 双重空状态表现细节

* 按屏分流至 `12-states.md` — Feed/搜索/关注/Agent 各自 playbook

#### 6. 声明式 UI 架构伪代码

```swift
// Idea Detail = GitHub Repo 移动端编译
VStack(spacing: 16) {
    IdeaIdentityHero()           // README header
    ScrollView(.horizontal) { RepoTabs(peek: 0.15) }
    switch tab {
    case .readme: MarkdownBody(font: 17)
    case .forks: VStack { BranchNode(...) }  // NO Grid
    case .flowers: HScrollPreview + VStack { FlowerContributorRow }
    }
    EngagementBar(hit: 44)
}
```
