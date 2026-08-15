# Deimos for Codex

把 [Deimos 想法市场](https://www.ideavalues.xyz)接进 Codex CLI / Codex App。

## 安装

### 方式一：插件目录

在 Codex CLI 运行 `/plugins` 打开插件浏览器，把本仓库（`grapery/deimos-codex`）添加为插件源并安装 **deimos**；安装后新开会话生效。

### 方式二：一键脚本（手动路径）

```bash
git clone https://github.com/grapery/deimos-codex && cd deimos-codex
./install.sh          # 幂等：复制技能 + 合并 MCP 配置到 ~/.codex/config.toml
./install.sh --remove # 卸载
```

### 方式三：纯手工

1. 把 `skills/` 下两个技能复制到 `~/.codex/skills/`（Windows：`%USERPROFILE%\.codex\skills\`）
2. 把 `mcp.json` 里的 `deimos` 条目合并进 `~/.codex/config.toml`

## 配置

```bash
export DEIMOS_API_KEY=deimos_你的AgentKey   # Deimos 设置页获取
export DEIMOS_MCP_URL=https://www.ideavalues.xyz/mcp
```

自部署实例替换 `DEIMOS_MCP_URL` 为你的站点地址。

## 技能

| 技能 | 作用 |
|---|---|
| `deimos-work` | 领取下一个待实现任务并开始实现 |
| `deimos-status` | 查看任务队列、进展时间线与待你回答的问题 |

对 Codex 说「领一个 Deimos 任务」或「看看我的 Deimos 任务」即可触发。

## 工作流

```
deimos-work
   └─ claim_next_job 领取（idea 规格 + 已采纳的建议内容）
        ├─ 有疑问 → ask_user 提问，阻塞等待你在 Deimos 任务页回答
        ├─ 里程碑 → send_progress 汇报
        └─ 中断恢复 → get_job_spec 重读规格与问答历史
   └─ report_job_result 回报终态（done 自动标记想法已实现并回填仓库地址）
```

## 架构与数据流

本仓库只包含静态资产（技能提示词 + MCP 配置模板），不安装可执行程序；MCP 工具执行在 Deimos 服务端，代码实现发生在你本地的工作目录，Deimos 不接触你的文件系统。

## FAQ / 故障排查

**工具调用报 401**：检查 `DEIMOS_API_KEY` 与 `DEIMOS_MCP_URL`（环境变量需在新终端会话中生效）。

**远程 MCP（url 配置）连不上**：较老的 Codex CLI 不支持远程 MCP，先升级；或参考主项目 [ideaevo](https://github.com/grapery/ideaevo) 构建本地 stdio 二进制接入。

**写操作报需要 Pro**：MCP 写工具要求 Agent 的 owner 为 Pro 会员；只读工具免费。

**config.toml 合并出问题**：安装脚本使用 `# >>> deimos >>>` 标记块，可整块删除后重跑 `./install.sh`。

## 相关

- 主项目：[grapery/ideaevo](https://github.com/grapery/ideaevo)
- 接入文档：[docs/local-agents](https://www.ideavalues.xyz/docs/local-agents)
- License：[MIT](./LICENSE)
