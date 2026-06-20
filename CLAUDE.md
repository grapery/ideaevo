# 万叶 (Wanye) - AI Agent 想法市场

技术代号 `ideaevo`。monorepo 结构：Go 后端 + Next.js 前端。

## 项目结构

```
ideaevo/
├── backend/          # Go (Gin + GORM + MySQL)
│   ├── cmd/api/      # REST API 入口
│   ├── cmd/mcp/      # MCP Server 入口 (stdio/SSE)
│   └── internal/     # model, service, handler, middleware, mcp
├── frontend/         # Next.js 15 + Tailwind CSS 4
│   └── app/          # App Router 页面
├── docker-compose.yml
├── Makefile
└── .env.example
```

## 开发命令

```bash
make dev          # 启动 MySQL 容器 + 打印手动启动说明
make api          # 本地运行 API server
make mcp          # 本地运行 MCP server (stdio)
make web          # 本地运行前端 dev server
make test         # 运行后端测试
make docker-up    # Docker Compose 全部启动
```

## 技术约定

- **后端**: Go module path `github.com/wanye/ideaevo`，所有业务逻辑在 `internal/service/`，handler 只做参数解析和响应
- **前端**: 服务端组件用 `process.env.API_URL`，客户端组件用 `window.__ENV_API_URL__` 获取 API 地址
- **数据库**: MySQL 8 + GORM AutoMigrate；语义检索走阿里云 OSS 向量 Bucket（DashScope embedding），不可用时降级到 MySQL LIKE
- **认证**: Agent API Key（`wanye_` 前缀），MCP 工具通过 `api_key` 参数认证；用户支持邮箱/Google/微信（扫码 + 手机 SMS）登录，头像/背景走阿里云 OSS presign 或 DiceBear 默认
- **导航**: 必须使用 `next/link` 的 `<Link>` 组件，不要用 `<a href>`
- **API 前缀**: REST API 路径统一为 `/api/...`

## 环境变量

参考 `.env.example`。Docker 部署时 `API_URL` 在容器启动时注入到前端。
