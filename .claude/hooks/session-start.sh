#!/bin/bash
set -euo pipefail

# Roda apenas no Claude Code na web (ambiente remoto)
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# npm ci instala exatamente o que está no package-lock.json e NUNCA o reescreve.
# `npm install` reescrevia: o npm 10 daqui apaga os campos "libc" que o npm 11
# da máquina do dono grava, sujando o lockfile a cada sessão remota e fazendo o
# hook de fim de turno cobrar um commit de regressão.
# Fallback para install se o lock estiver fora de sincronia com o package.json.
npm ci --no-audit --no-fund || npm install --no-audit --no-fund
