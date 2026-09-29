#!/bin/sh
# Web server and scanner side by side in one container.
# The web server runs in the foreground: if it exits, the container exits and the platform restarts it.
# The scanner is supervised here: restarted 30s after a failure, so a crash cannot silently stop the data
# from updating while pages keep serving. A clean exit (DEMO_MODE, nothing to scan) ends the loop.
mkdir -p "$(dirname "${TIDE_DB_PATH:-/data/site.db}")"
(
  until pnpm worker; do
    echo "scanner worker exited with status $?; restarting in 30s" >&2
    sleep 30
  done
) &
PORT="${PORT:-3000}" exec pnpm start
