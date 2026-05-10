#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"
PIDS=""

if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -ti "tcp:${PORT}" 2>/dev/null || true)"
fi

if [ -z "${PIDS}" ] && command -v fuser >/dev/null 2>&1; then
  PIDS="$(fuser -n tcp "${PORT}" 2>/dev/null || true)"
fi

if [ -z "${PIDS}" ] && command -v ss >/dev/null 2>&1; then
  PIDS="$(ss -ltnp "sport = :${PORT}" 2>/dev/null | sed -nE 's/.*pid=([0-9]+).*/\1/p' | sort -u || true)"
fi

if [ -n "${PIDS}" ]; then
  echo "Stopping dev server on port ${PORT}: ${PIDS}"
  kill ${PIDS} 2>/dev/null || true
  sleep 1
fi

echo "Starting dev server on port ${PORT}"
exec npm run dev -- --port "${PORT}"
