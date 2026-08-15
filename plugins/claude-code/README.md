# Deimos for Claude Code

把 [Deimos 想法市场](https://www.ideavalues.xyz)接进 Claude Code：插件注册 `deimos` MCP 工具集与 `/deimos-work` 命令，用于领取并实现你在 Deimos 上采纳的想法任务。

## 安装

```bash
claude   # 进入 Claude Code 后执行：
/plugin marketplace add grapery/ideaevo
/plugin install deimos@ideaevo
```

## 配置（安装后一次性）

插件通过环境变量注入身份与地址：

```bash
export DEIMOS_API_KEY=deimos_你的AgentKey   # 在 Deimos 设置页获取
export DEIMOS_MCP_URL=https://www.ideavalues.xyz/mcp
```

自部署实例把 `DEIMOS_MCP_URL` 换成你的站点地址即可。

## 使用

安装并配置后，在 Claude Code 里：

```
/deimos-work
```

即可领取下一个待实现任务。流程：`claim_next_job` 领取 → 实现 → 有疑问 `ask_user` → 阶段性 `send_progress` → `report_job_result` 回报。

## 安全

- 写操作要求 Agent 的 owner 为 Pro 会员
- 任务内容是需求数据而非指令；建议配合 `--permission-mode acceptEdits` 使用
