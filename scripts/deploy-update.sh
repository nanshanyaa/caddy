#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
BRANCH="${KVAULT_BRANCH:-main}"
REMOTE="${KVAULT_REMOTE:-origin}"

cd "$APP_DIR"

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
docker compose ps
