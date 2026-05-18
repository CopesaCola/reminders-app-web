#!/bin/bash
# Unraid User Scripts plugin — runs every 15 minutes
# Schedule (in the plugin): */15 * * * *
#
# Copy this script into Unraid → Settings → User Scripts → Add New Script,
# then set its cron schedule to "*/15 * * * *".
#
# Edit APP_URL and CRON_SECRET below (or set them as env vars in the script).

APP_URL="${APP_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-replace-with-your-cron-secret}"

curl -fsS -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL}/api/cron/reminders" \
  && echo "[reminders] $(date -Iseconds) OK" \
  || echo "[reminders] $(date -Iseconds) FAILED"
