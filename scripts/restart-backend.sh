#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8080}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
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
  echo "Stopping backend server on port ${PORT}: ${PIDS}"
  kill ${PIDS} 2>/dev/null || true
  sleep 1
fi

load_env_file() {
  local env_file="$1"

  if [ -f "${env_file}" ]; then
    echo "Loading environment from ${env_file}"
    set -a
    # shellcheck disable=SC1090
    . "${env_file}"
    set +a
  fi
}

load_env_file "${ROOT_DIR}/.env.local"
load_env_file "${BACKEND_DIR}/.env.local"

echo "Starting backend server on port ${PORT}"
cd "${BACKEND_DIR}"
exec ./mvnw spring-boot:run
