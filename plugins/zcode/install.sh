#!/usr/bin/env bash
# Deimos for Zcode 安装/卸载脚本（技能手动路径；MCP 配置各版本入口不同，脚本输出指引）
# 用法：
#   ./install.sh          安装技能并打印 MCP 配置指引
#   ./install.sh --remove 卸载技能
set -euo pipefail

ZCODE_SKILLS="${ZCODE_SKILLS_DIR:-$HOME/.zcode/skills}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "${1:-}" = "--remove" ]; then
  rm -rf "$ZCODE_SKILLS/deimos-work" "$ZCODE_SKILLS/deimos-status"
  echo "已移除技能。MCP 配置与环境变量请按原安装方式自行清理。"
  exit 0
fi

mkdir -p "$ZCODE_SKILLS"
cp -R "$SCRIPT_DIR/skills/deimos-work" "$ZCODE_SKILLS/"
cp -R "$SCRIPT_DIR/skills/deimos-status" "$ZCODE_SKILLS/"
echo "已安装技能：deimos-work、deimos-status → $ZCODE_SKILLS"

cat <<'HINT'
接下来把 MCP server 加入 Zcode 的 MCP 配置（mcp.json 内容如下，变量从环境读取）：
{
  "mcpServers": {
    "deimos": {
      "url": "\${DEIMOS_MCP_URL}",
      "headers": { "Authorization": "Bearer \${DEIMOS_API_KEY}" }
    }
  }
}

环境变量（写入 shell 配置后重开终端）：
  export DEIMOS_API_KEY=deimos_你的AgentKey
  export DEIMOS_MCP_URL=https://www.ideavalues.xyz/mcp
HINT

if [ -z "${DEIMOS_API_KEY:-}" ]; then echo; echo "⚠ 当前未检测到 DEIMOS_API_KEY"; fi
echo "安装完成。对 Zcode 说「领一个 Deimos 任务」即可开始。"
