#!/usr/bin/env bash
# Deimos for Codex 安装/卸载脚本（手动路径的幂等安装）
# 用法：
#   ./install.sh          安装（复制技能 + 合并 MCP 配置）
#   ./install.sh --remove 卸载
set -euo pipefail

CODEX_DIR="${CODEX_DIR:-$HOME/.codex}"
SKILL_DST="$CODEX_DIR/skills/deimos-work"
STATUS_DST="$CODEX_DIR/skills/deimos-status"
CONFIG="$CODEX_DIR/config.toml"
BEGIN_MARK="# >>> deimos (grapery/deimos-codex) >>>"
END_MARK="# <<< deimos (grapery/deimos-codex) <<<"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

remove_block() {
  [ -f "$CONFIG" ] || return 0
  python3 - "$CONFIG" <<'PY'
import sys
p = sys.argv[1]
src = open(p).read()
begin, end = "# >>> deimos (grapery/deimos-codex) >>>", "# <<< deimos (grapery/deimos-codex) <<<"
if begin in src and end in src:
    pre = src.split(begin)[0].rstrip("\n")
    post = src.split(end)[1].lstrip("\n")
    open(p, "w").write((pre + "\n" if pre else "") + (post if post else ""))
    print("已从 config.toml 移除 deimos 配置块")
PY
}

if [ "${1:-}" = "--remove" ]; then
  rm -rf "$SKILL_DST" "$STATUS_DST" && echo "已移除技能：$SKILL_DST"
  remove_block
  echo "卸载完成。环境变量（DEIMOS_API_KEY / DEIMOS_MCP_URL）请自行清理。"
  exit 0
fi

mkdir -p "$CODEX_DIR/skills"
cp -R "$SCRIPT_DIR/skills/deimos-work" "$SKILL_DST"
cp -R "$SCRIPT_DIR/skills/deimos-status" "$STATUS_DST"
echo "已安装技能：deimos-work、deimos-status → $CODEX_DIR/skills/"

touch "$CONFIG"
if grep -qF "$BEGIN_MARK" "$CONFIG"; then
  echo "config.toml 已包含 deimos 配置块，跳过合并"
else
  cat >> "$CONFIG" <<TOML
$BEGIN_MARK
# 环境变量在 MCP 启动时展开（shell 配置里 export 后重开终端）
[mcp_servers.deimos]
url = "\${DEIMOS_MCP_URL}"
http_headers = { "Authorization" = "Bearer \${DEIMOS_API_KEY}" }
$END_MARK
TOML
  echo "已合并 MCP 配置到 $CONFIG"
fi

if [ -z "${DEIMOS_API_KEY:-}" ] || [ -z "${DEIMOS_MCP_URL:-}" ]; then
  cat <<'HINT'

⚠ 未检测到环境变量，请在 shell 配置（~/.zshrc 等）中设置后重开终端：
  export DEIMOS_API_KEY=deimos_你的AgentKey
  export DEIMOS_MCP_URL=https://www.ideavalues.xyz/mcp
HINT
fi
echo "安装完成。对 Codex 说「领一个 Deimos 任务」即可开始。"
