#!/bin/bash
# Goal Tracking app — Unraid setup helper.
#
# Run this on your Unraid box once. It:
#   1. Creates the "reminders" Docker network (if missing)
#   2. Creates the appdata directory
#   3. Downloads the three Unraid container templates
#   4. Generates all secrets (postgres password, session secret, VAPID keypair, cron secret)
#   5. Writes them to /mnt/user/appdata/reminders/secrets.env (mode 600)
#   6. Prints exactly what to paste into each Unraid template form
#
# After running, finish in the Unraid Docker tab:
#   - Docker → Add Container → Template dropdown → reminders-postgres
#   - then reminders-app
#   - then reminders-cron
#   - then cloudflared from Community Apps
#
# Idempotent — safe to re-run. Won't overwrite secrets.env if it already exists.

set -euo pipefail

# --- Config ---
APPDATA="${APPDATA:-/mnt/user/appdata/reminders}"
REPO_RAW="${REPO_RAW:-https://raw.githubusercontent.com/CopesaCola/reminders-app-web/main}"
TEMPLATES_DIR="/boot/config/plugins/dockerMan/templates-user"
SECRETS_FILE="$APPDATA/secrets.env"

# Pretty output
bold=$'\033[1m'
green=$'\033[32m'
yellow=$'\033[33m'
dim=$'\033[2m'
reset=$'\033[0m'
step() { echo "${bold}→${reset} $*"; }
ok()   { echo "  ${green}✓${reset} $*"; }
warn() { echo "  ${yellow}!${reset} $*"; }

# --- Sanity checks ---
if [ ! -d /boot/config ]; then
  echo "${yellow}This doesn't look like an Unraid box (/boot/config missing).${reset}"
  echo "If you're testing elsewhere, set TEMPLATES_DIR before running."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not on PATH. Bailing."
  exit 1
fi

echo "${bold}=== Goal Tracking app — Unraid setup ===${reset}"
echo ""

# --- 1. Network ---
step "Docker network 'reminders'"
if docker network inspect reminders >/dev/null 2>&1; then
  ok "already exists"
else
  docker network create reminders >/dev/null
  ok "created"
fi

# --- 2. Appdata dir ---
step "Appdata directory $APPDATA"
mkdir -p "$APPDATA/postgres"
ok "ready"

# --- 3. Templates ---
step "Unraid templates"
mkdir -p "$TEMPLATES_DIR"
for f in reminders-postgres.xml reminders-app.xml reminders-ofelia.xml; do
  dest="$TEMPLATES_DIR/my-$f"
  if curl -fsS "$REPO_RAW/unraid/templates/$f" -o "$dest"; then
    ok "$f → $dest"
  else
    warn "failed to download $f — Unraid may not have internet, or the repo path is wrong"
    echo "    REPO_RAW=$REPO_RAW"
    exit 1
  fi
done

# --- 4. Secrets ---
step "Secrets"
if [ -f "$SECRETS_FILE" ]; then
  warn "$SECRETS_FILE already exists — keeping existing values"
  warn "delete it and re-run if you want fresh secrets"
else
  echo "  generating (this takes ~30s — pulls a node image once)..."

  POSTGRES_PASSWORD=$(docker run --rm node:20-alpine node -e \
    'process.stdout.write(require("crypto").randomBytes(24).toString("base64url"))')
  SESSION_SECRET=$(docker run --rm node:20-alpine node -e \
    'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')
  CRON_SECRET=$(docker run --rm node:20-alpine node -e \
    'process.stdout.write(require("crypto").randomBytes(24).toString("hex"))')

  # VAPID keys — uses web-push installed inside an ephemeral container
  VAPID_JSON=$(docker run --rm node:20-alpine sh -c \
    'npm install -g --silent --no-audit --no-fund web-push >/dev/null 2>&1 && web-push generate-vapid-keys --json')
  # Cheap JSON extraction — values are base64url, no escaping concerns
  VAPID_PUBLIC_KEY=$(echo "$VAPID_JSON"  | sed -n 's/.*"publicKey":"\([^"]*\)".*/\1/p')
  VAPID_PRIVATE_KEY=$(echo "$VAPID_JSON" | sed -n 's/.*"privateKey":"\([^"]*\)".*/\1/p')

  if [ -z "$VAPID_PUBLIC_KEY" ] || [ -z "$VAPID_PRIVATE_KEY" ]; then
    warn "failed to parse VAPID keys from web-push output:"
    echo "$VAPID_JSON"
    exit 1
  fi

  umask 077
  cat > "$SECRETS_FILE" <<EOF
# Generated $(date -Iseconds) by unraid/setup.sh
# Paste these into the Unraid template forms when adding each container.

# --- reminders-postgres ---
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# --- reminders-app ---
# Use this DATABASE_URL verbatim (already has the password inlined):
DATABASE_URL=postgres://reminders:$POSTGRES_PASSWORD@reminders-postgres:5432/reminders
SESSION_SECRET=$SESSION_SECRET
VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=$VAPID_PRIVATE_KEY
CRON_SECRET=$CRON_SECRET

# --- You still need to choose: ---
# APP_PASSWORD=<the password you'll log in with>
# APP_TIMEZONE=<e.g. America/New_York>
# VAPID_SUBJECT=mailto:<your-email>
EOF
  chmod 600 "$SECRETS_FILE"
  ok "written to $SECRETS_FILE (mode 600)"
fi

# --- 5. Next steps ---
cat <<NEXT

${bold}=== Next steps ===${reset}

${bold}1.${reset} Make the GHCR package public (one-time, in browser):
   https://github.com/CopesaCola?tab=packages → reminders-app
   → Package settings (right sidebar) → Change visibility → Public

${bold}2.${reset} In Unraid → Docker → Add Container:
   Click the "Template" dropdown at the top — you'll see:
     • reminders-postgres
     • reminders-app
     • reminders-cron
   Add them in that order. Reference $SECRETS_FILE for the env values.

${bold}3.${reset} Install ${dim}cloudflared${reset} separately from Community Apps for HTTPS.
   In Cloudflare Zero Trust dashboard, route your public hostname to
   ${dim}HTTP → reminders-app:3152${reset}.

${bold}Secrets file:${reset}
   ${dim}cat $SECRETS_FILE${reset}

NEXT
