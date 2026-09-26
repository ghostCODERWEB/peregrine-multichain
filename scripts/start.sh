#!/bin/sh
# Web server and scanner side by side; if either exits, the container restarts.
mkdir -p "$(dirname "${TIDE_DB_PATH:-/data/site.db}")"
pnpm worker &
exec pnpm start -p "${PORT:-3000}"
