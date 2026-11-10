#!/bin/sh
# Install a skill from this repository (macOS, Linux, WSL).
#   sh scripts/install.sh claude              -> ~/.claude/skills/show-me      (Claude Code)
#   sh scripts/install.sh codex               -> ~/.agents/skills/show-me      (Codex)
#   sh scripts/install.sh openclaw <workspace> -> <workspace>/skills/phone-viz (OpenClaw)
set -e
root=$(cd "$(dirname "$0")/.." && pwd)
case "$1" in
  claude) skill=show-me; dest="$HOME/.claude/skills" ;;
  codex) skill=show-me; dest="$HOME/.agents/skills" ;;
  openclaw) [ -n "$2" ] || { echo "usage: install.sh openclaw <workspace>"; exit 1; }; skill=phone-viz; dest="$2/skills" ;;
  *) echo "usage: install.sh claude | codex | openclaw <workspace>"; exit 1 ;;
esac
mkdir -p "$dest"
if [ -e "$dest/$skill" ]; then
  backup="$(dirname "$dest")/skill-backups/$skill-$(date +%Y%m%d%H%M%S)"
  mkdir -p "$(dirname "$backup")"; mv "$dest/$skill" "$backup"; echo "Moved the previous $skill to $backup"
fi
cp -R "$root/skills/$skill" "$dest/$skill"
echo "Installed: $dest/$skill"
node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' 2>/dev/null || echo "Warning: the scripts need Node 22 or newer."
