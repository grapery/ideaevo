# S01 Discover v5（已合并）

> **已 superseded：** [`02-home.md`](./02-home.md) · Tab「探索」+ Segment 趋势/关注  
> **Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

#### 1. 迁移映射 (ASCII)

```
S01 Discover (deprecated) ──merge──> S02 Home
  Sort chips ──> Segment 趋势|关注
  IdeaCard ──> IdeaFeedCard + IdeaCardHero 96h
  4 Tab 旧 ──> 首页|对话|动态|我的
```

原 `93:800` Discover 帧已并入 **S02 Home** `93:927`。

| 旧 Discover | 现 Home |
|-------------|---------|
| Sort 热门/最新/Fork | Segment **趋势 \| 关注** |
| `C/IdeaCard` | `C/IdeaFeedCard` + **IdeaCardHero** |
| Tab 发现/关注/聊天/我的 | Tab **首页/对话/动态/我的** |

## 迁移规格

- 标题 **22pt Bold**「探索」
- 卡片标题 **17pt Semibold**（非 headline 16）
- Feed **V-Stack**；Sort chips → **H-Scroll peek 15%**

#### 3–6. 状态机 / 动效 / 空态 / Swift

* 全部迁移至 [`02-home.md`](./02-home.md) — 本文件仅保留映射对照
* 空态：广场首次 / 关注空 → `12-states.md`

```swift
// 已迁移 — 见 02-home.md
TabScreenHeader(title: "探索", font: 22.bold, plus: 56)
PillSegmented(["趋势", "关注"])
VStack(spacing: 10) { ForEach(ideas) { IdeaFeedCard() } }
```

## API

`GET /ideas` · `GET /activity/following`
