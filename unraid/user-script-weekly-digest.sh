#!/bin/bash
# Unraid User Scripts plugin — Sunday weekly digest
# Schedule (in the plugin): 0 18 * * 0   (Sunday at 18:00 local Unraid time)

APP_URL="${APP_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-replace-with-your-cron-secret}"

curl -fsS -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL}/api/cron/weekly-digest" \
  && echo "[digest] $(date -Iseconds) OK" \
  || echo "[digest] $(date -Iseconds) FAILED"
