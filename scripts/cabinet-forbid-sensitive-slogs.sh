#!/usr/bin/env bash
# Статическая проверка: в internal/cabinet не должно появляться логирование
# чувствительных полей как ключей slog (см. этап 10 implementation-plan).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if ! command -v rg >/dev/null 2>&1; then
  echo "rg (ripgrep) not installed; skip cabinet slog pattern check"
  exit 0
fi
if rg -n --glob '*.go' \
  'slog\.(Info|Warn|Error|Debug)\([^;]*"(access_token|refresh_token|id_token|init_data)"\s*,' \
  internal/cabinet; then
  echo "ERROR: forbidden token-like slog attribute keys under internal/cabinet"
  exit 1
fi
echo "cabinet slog static check: OK"
