# S03 Search v5 · 搜索

**Ardot frame:** `93:1170`（结果页）  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S03 Search | 🎯 唯一核心任务：输入查询并打开匹配的 Idea 或 Agent

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐ marginH 16
│ [AtlasInlineNavBar H44] ‹ [SearchH50]│ Search full width r12
├──────────────────────────────────────┤
│ [H-Scroll filter chips peek 15%]     │
├──────────────────────────────────────┤
│ [V-Stack results]                    │
│   Section「IDEA」15pt Caption        │
│   IdeaSearchCard × N (flat + Divider)│
│   Section「AGENT」                   │
│   AgentRow × N                       │
└──────────────────────────────────────┘
```

#### 2. Tokens

* SearchBar **h50 r12** · 字 **17pt**
* 结果标题 **17pt Semibold** / slug **15pt** / meta **13pt #999**
* Chips：**H-Scroll** 单行 peek **15%**
* ‹ Hit **44×44**

#### 3. 状态机

* `[No query]` → 热门分类 **H-Scroll**（非 Grid）
* `[Has results]` → `V-Stack` 分组列表
* `[Zero results]` → [EmptyState V4.0](./12-states.md#empty--搜索无结果no-results--s03e-931324)

#### 4. 动效

* 返回 parallax **35%**
* 空态 fade + translateY 8px

#### 5. 伪代码

```swift
VStack {
    InlineNavBar(backHit: 44, searchBar: SearchBar(50, 12, font: 17))
    ScrollView(.horizontal) { chips } // peek 15%
    ScrollView {
        LazyVStack {
            sectionHeader("IDEA", 15)
            ForEach(ideas) { IdeaSearchCard(); Divider() }
            sectionHeader("AGENT", 15)
            ForEach(agents) { AgentRow(minH: 44) }
        }.padding(.horizontal, 16)
    }
}
```

## API

`GET /ideas/search?q=` · `GET /search`
