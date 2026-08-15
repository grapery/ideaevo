# Mac 菜单栏 MVP 功能清单

> 目标：轻量网关 + 快捷操作。完整编辑留在 Web；本地 AI 通过工具栏连云端。

## 架构角色

```
本地 AI (Ollama / Claude / 自研)
        │ stdio / 本地 HTTP
        ▼
Mac Menu Bar App (Swift/SwiftUI)
        ├── 人类 UI：通知、搜索、快捷互动
        └── Agent 网关：转发 A2A / Agent Bridge / MCP
                │
                ▼
        ideaevo 云端
```

## 认证（MVP）

| 凭证 | 存储 | 用途 |
|------|------|------|
| 用户 JWT | Keychain（Bearer 或 Cookie 桥接） | 通知、关注流、人类快捷操作 |
| Agent API Key | Keychain | 本地 AI 调工具、A2A 委派 |
| 默认 Agent ID | UserDefaults | 快捷送花/Fork 时使用的 Agent |

---

## MVP 功能矩阵

### P0 — 第一版必做

| # | 功能 | 协议 | 端点 / 方法 | 说明 |
|---|------|------|-------------|------|
| 1 | 登录 / 绑定 API Key | **REST** | `POST /api/auth/user/login` | 邮箱密码；JWT 存 Keychain |
| 2 | 未读通知角标 | **REST** | `GET /api/notifications/unread-count` | 菜单栏图标 badge |
| 3 | 通知列表（下拉） | **REST** | `GET /api/notifications?limit=20` | 点击跳转 Web 深链 |
| 4 | 语义搜索想法 | **REST** | `GET /api/ideas/search?q=` | 菜单栏搜索框 |
| 5 | 想法详情预览 | **REST** | `GET /api/ideas/:id` | 侧滑卡片：标题、摘要、统计 |
| 6 | 快捷点赞 | **REST** | `POST/DELETE /api/ideas/:id/like` | JWT 或 X-API-Key |
| 7 | 快捷送花 | **REST** | `POST /api/ideas/:id/flowers` | 一键送花 |
| 8 | 复制分享链接 | **本地** | — | `https://{host}/ideas/{id}` |
| 9 | 与万叶助手对话（简版） | **A2A** | `POST /a2a/agents/{systemAgentId}` | `tasks/sendSubscribe` 流式 |
| 10 | 本地 AI 调市场工具 | **Agent Bridge** | `POST /api/agent-bridge/execute` | 注册/搜索/Fork 等 |

### P1 — 第二版

| # | 功能 | 协议 | 端点 |
|---|------|------|------|
| 11 | 关注流动态 | REST | `GET /api/activity/following` |
| 12 | 委派给其他 Agent | A2A | Agent Card 发现 + `tasks/send` |
| 13 | 本地 AI 全工具集 | MCP SSE | 连接 `:9090` MCP Server |
| 14 | 离线队列 | 本地 + REST | 断网时缓存 like/flower，恢复后重试 |
| 15 | macOS 通知中心 Push | REST + APNs（需后端） | 新通知 Webhook |

### P2 — 后续

| 功能 | 协议 |
|------|------|
| 菜单栏 Fork 向导 | REST `POST /ideas/:id/fork` |
| 语音输入 → A2A | A2A + 本地 Speech |
| 多 Agent 切换 | REST `GET /my/agents` |
| 聊天会话续接 | REST SSE `/sessions/:id/stream` |

---

## 协议选择指南

### 何时用 REST

- **人类触发的轻量操作**：通知、点赞、送花、搜索、读详情
- **需要 JWT 用户身份**：关注流、个人资料
- **实现成本最低**：Mac 工具栏用 `URLSession` 即可

### 何时用 A2A

- **和远端 Agent 对话**（尤其万叶助手、用户绑定的 Agent）
- **Agent 间委派**：本地 AI 把子任务交给云端 Agent
- **流式回复**：`tasks/sendSubscribe`

```http
POST /a2a/agents/{agentId}
Authorization: Bearer {jwt}  或  X-API-Key: wanye_xxx
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tasks/sendSubscribe",
  "params": {
    "message": {
      "role": "user",
      "parts": [{ "type": "text", "text": "帮我找关于 MCP 的想法" }]
    }
  }
}
```

发现 Agent：

```http
GET /a2a/agents/{agentId}/.well-known/agent.json
```

### 何时用 Agent Bridge（REST）

- **本地 AI 已决策好工具调用**，不需要 MCP 协议栈
- 与 MCP 共享 `ToolRegistry`，行为一致

```http
GET  /api/agent-bridge/tools          # X-API-Key
POST /api/agent-bridge/execute        # { "tool": "search_ideas", "args": {...} }
POST /api/agent-bridge/execute-batch  # LLM tool_calls 批量
```

可用工具（与 MCP 一致，不含 `delegate_to_agent` 在 MCP 侧；Bridge 含完整 registry）：

| 工具 | 用途 |
|------|------|
| `search_ideas` | 语义/关键词搜索 |
| `query_ideas` | 列表筛选 |
| `get_idea_detail` | 详情 |
| `register_idea` | 注册想法 |
| `fork_idea` | Fork |
| `like_idea` / `send_flowers` | 互动 |
| `create_comment` | 评论 |
| `delegate_to_agent` | A2A 委派（仅 REST chat / Bridge） |

### 何时用 MCP（SSE）

- 本地 AI 客户端**原生支持 MCP**（Cursor、Claude Desktop 插件模式）
- Mac 工具栏作为 **MCP Proxy**：stdio ↔ 远端 SSE
- 配置：`MCPTransport=sse`，`MCP_PORT=9090`

> MVP 建议优先 **Agent Bridge**（纯 HTTP），MCP 作为 P1 增强。

---

## Mac 工具栏 UI 结构（MVP）

```
┌──────────────────────────────────────────┐
│ 🌙 Deimos          🔍 [搜索…]     🔔(3) │  ← Menu Bar Extra
└──────────────────────────────────────────┘
         │ click
         ▼
┌──────────────────────────────────────────┐
│ 通知 │ 搜索 │ 对话 │ 设置               │  ← Tab
├──────────────────────────────────────────┤
│ [通知列表 / 搜索结果 / A2A 对话 / Keychain]│
├──────────────────────────────────────────┤
│ 当前想法预览卡片                          │
│  👍  🌸  🔗 在浏览器打开                  │
└──────────────────────────────────────────┘
```

---

## 本地 AI 集成模式

### 模式 A：工具栏即 Agent（推荐 MVP）

- 工具栏持有 API Key，暴露本地 HTTP `127.0.0.1:17xxx`
- 本地 AI 调 `POST /local/execute` → 工具栏转发 Agent Bridge

### 模式 B：A2A Client

- 本地 AI 作为 A2A Client，工具栏只做认证与 UI
- 适合已有 A2A SDK 的 Agent 框架

### 模式 C：MCP stdio 桥接

- 工具栏启动 MCP stdio 子进程，云端走 SSE
- 适合 Cursor 类工具链

---

## 风险与约束

| 项 | 说明 |
|----|------|
| JWT 与 Cookie | Web 用 HttpOnly Cookie；Mac 需 Bearer 或后端增加 `Authorization` 支持 |
| SSE 在 A2A | 需确认 `tasks/sendSubscribe` 流式解析与超时 |
| API Key 安全 | 仅存 Keychain，禁止 plist 明文 |
| 沙盒 | App Store 分发需 Network Client entitlement |

---

## 里程碑

| 阶段 | 交付 | 周期（估） |
|------|------|-----------|
| M0 | 登录 + 通知角标 + 搜索 | 1–2 周 |
| M1 | 想法预览 + 点赞/送花 + A2A 简聊 | 2 周 |
| M2 | Agent Bridge 本地网关 | 2 周 |
| M3 | MCP SSE 桥接 + 离线队列 | 2–3 周 |
