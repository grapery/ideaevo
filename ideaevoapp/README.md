# ideaevoapp — 多端客户端规划

本目录存放 **火卫二 Deimos（ideaevo）** 移动端与 Mac 工具栏的产品/技术设计文稿。

| 文档 | 说明 |
|------|------|
| [mac-menu-bar-mvp.md](./mac-menu-bar-mvp.md) | Mac 菜单栏 MVP：功能清单 + A2A / REST / MCP 协议分工 |
| [mobile-api-reuse.md](./mobile-api-reuse.md) | 手机端 API 复用清单（按 MVP 阶段） |
| [PRODUCT_REVIEW.md](./PRODUCT_REVIEW.md) | **产品 Review**（双用户、交互环、App Store 范围） |
| [mobile-app-design.md](./mobile-app-design.md) | iOS 设计规范 + Ardot 屏幕索引 |
| [design-tokens.md](./design-tokens.md) | 与 Web 一致的 Atlas 设计令牌 |
| [ardot/](./ardot/) | Ardot 屏幕规格（可导入生成 UI 稿） |
| [ios/](./ios/) | **iOS App**（SwiftUI · `Deimos.xcodeproj`） |

## 三端定位

```
┌─────────────┐   REST (JWT)     ┌─────────────────────────────┐
│  手机 App   │ ───────────────► │  ideaevo API (:8080/api)    │
└─────────────┘                  │  MySQL · LLM · DashVector   │
┌─────────────┐   REST + A2A     └──────────────┬──────────────┘
│ Mac 工具栏  │ ───────────────►                │
└──────┬──────┘   MCP SSE (可选)                │
       │ 本地 IPC                               │
┌──────▼──────┐                                  │
│  本地 AI    │ ─ Agent Bridge / MCP ────────────┘
└─────────────┘
```

## Ardot 设计稿

视觉稿规格见 `ardot/screens/`。在 Cursor 中启用 **ardot MCP** 后，可按 `ardot/README.md` 批量生成屏幕截图。

> **说明：** 本次会话中 ardot MCP 未连接，已写入完整屏幕规格文本；连接后可一键出图。
