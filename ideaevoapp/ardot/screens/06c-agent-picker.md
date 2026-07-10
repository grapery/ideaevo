# S06C Agent Picker v5 · 选择 Agent

**Ardot frame:** `93:1242`  
**iOS:** `ChatAgentPickerView`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S06C Agent Picker | 🎯 唯一核心任务：选择一个 Agent 发起对话

#### 1. ASCII Wireframe（Sheet D）

```
[Root dim 0.4 scale 0.95]
┌─ Sheet R20 top ──────────────────────┐
│ [Handle 40×4 r2]                     │
│ [TitleRow] X Hit44 | 选择 Agent 17pt Bold | (spacer) │
│ Spacer(12)                           │
│ [Optional IdeaContext tint #B8F5EC]   │ single card r16
│ [SearchBar h50 r12 17pt]             │
│ [V-Stack agents]                     │
│   Row Avatar48 name17 desc15 minH56  │
│   ─── Divider #E5E5E5 ───            │
└──────────────────────────────────────┘
```

#### 2. Tokens · 3. 状态机

* Nav 取消 **X Hit 44** / 搜索 **17pt** / Agent 名 **17pt Semibold**
* 列表 **V-Stack + Divider** — 禁止 Agent 卡网格
* `[Idle]` → Sheet · `[Select]` → dismiss + create session

#### 3. 动效

* Sheet 打开：**zoom 95% + dim 0.4**
* 关闭：反向恢复

#### 4. 双重空状态表现细节

* 无 Agent：Text **17pt** 居中「暂无可用 Agent」— **禁止** 空卡片网格
* 搜索无匹配：**15pt #666** + Button 清除 **Hit 44**

#### 5. 声明式 UI 架构伪代码

```swift
.sheet {
    VStack(spacing: 0) {
        HandleBar(40, 4)
        TitleRow(close: 44, title: 17.bold)
        ideaContextBar?.padding(.horizontal, 16)
        SearchBar(height: 50, font: 17)
        VStack(spacing: 0) {
            ForEach(filteredAgents) { agent in
                AgentPickerRow(avatar: 48, minH: 56)
                Divider().foregroundStyle(#E5E5E5)
            }
        }
    }
}
```

## API

`GET /agents` · local filter
