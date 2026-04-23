#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
BRANCH="${KVAULT_BRANCH:-main}"
REMOTE="${KVAULT_REMOTE:-origin}"

cd "$APP_DIR"

read_env_value() {
  key="$1"
  if [ ! -f .env ]; then
    return 0
  fi

  grep -E "^${key}=" .env \
    | tail -n 1 \
    | cut -d= -f2- \
    | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//;s/^'\''//;s/'\''$//'
}

diagnose_container() {
  container="$1"
  echo "---- docker compose ps ----" >&2
  docker compose ps >&2 || true
  echo "---- ${container} logs ----" >&2
  docker logs --tail=120 "$container" >&2 || true
}

wait_for_container_healthy() {
  container="$1"
  timeout_seconds="${2:-120}"
  start_time="$(date +%s)"

  echo "Waiting for ${container} to become healthy..."
  while :; do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"
    if [ "$status" = "healthy" ]; then
      echo "${container} is healthy."
      return 0
    fi

    now="$(date +%s)"
    if [ $((now - start_time)) -ge "$timeout_seconds" ]; then
      echo "${container} did not become healthy within ${timeout_seconds}s (last status: ${status:-unknown})." >&2
      diagnose_container "$container"
      return 1
    fi

    sleep 2
  done
}

check_http_health() {
  web_port="${WEB_PORT:-$(read_env_value WEB_PORT)}"
  health_url="${KVAULT_HEALTH_URL:-http://127.0.0.1:${web_port:-8080}/api/health}"

  echo "Checking ${health_url}..."
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "$health_url"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$health_url"
  else
    docker compose exec -T api node -e "fetch('http://127.0.0.1:8787/api/health').then(async (r) => { const text = await r.text(); if (!r.ok) throw new Error(text || r.statusText); console.log(text); }).catch((error) => { console.error(error.message || error); process.exit(1); })"
  fi
  echo
}

if [ ! -d .git ]; then
  echo "This directory is not a Git checkout: $APP_DIR" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.example to .env and fill secrets before deploying." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree has local tracked changes. Commit, stash, or discard them before updating." >&2
  exit 1
fi

git fetch --prune "$REMOTE" "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only "$REMOTE" "$BRANCH"

docker compose up -d --build
wait_for_container_healthy kvault-api "${KVAULT_HEALTH_TIMEOUT:-120}"
wait_for_container_healthy kvault-web "${KVAULT_HEALTH_TIMEOUT:-120}"
check_http_health
docker compose ps
