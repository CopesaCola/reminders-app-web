#!/bin/sh
set -e

echo "[entrypoint] running migrations…"
node scripts/migrate.mjs

echo "[entrypoint] starting Next.js server"
exec "$@"
