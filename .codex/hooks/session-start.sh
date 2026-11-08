#!/bin/bash
set -euo pipefail

# Roda apenas no Claude Code na web (ambiente remoto)
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
npm install --no-audit --no-fund
