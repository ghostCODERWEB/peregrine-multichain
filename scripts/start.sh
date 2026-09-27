#!/bin/sh
# Web server and scanner side by side; if either exits, the container restarts.
mkdir -p "$(dirname "${TIDE_DB_PATH:-/data/site.db}")"
pnpm worker &
PORT="${PORT:-3000}" exec pnpm start
