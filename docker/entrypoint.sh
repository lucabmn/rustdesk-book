#!/bin/sh
# Apply pending database migrations, then start the server.
set -e

echo "[entrypoint] running database migrations"
node .output/migrate.mjs

echo "[entrypoint] starting rustdesk-book on port ${PORT:-3000}"
exec node .output/server/index.mjs
