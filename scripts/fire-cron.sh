#!/bin/sh
# Helper invoked by Ofelia (or anything else) to hit one of the cron endpoints.
# Reads CRON_SECRET from the container environment, so labels don't need to embed it.
#
# Usage: fire-cron reminders
#        fire-cron weekly-digest
set -e

if [ -z "${1:-}" ]; then
  echo "usage: fire-cron <endpoint>" >&2
  exit 2
fi

if [ -z "${CRON_SECRET:-}" ]; then
  echo "fire-cron: CRON_SECRET not set in env" >&2
  exit 2
fi

exec curl -fsS -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:${PORT:-3000}/api/cron/$1"
