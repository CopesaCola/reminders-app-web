# Accountability

A single-user, web-based goal tracker with push notification reminders. Installs as a PWA on desktop and mobile.

## Features

- **Three goal types** — binary (did it / didn't), quantitative (sum a value to hit a target), milestone (long projects)
- **Daily / weekly / monthly cadence** with per-period streaks
- **Why-statement** per goal — pinned during check-ins
- **Pause** goals so streaks don't break on vacation
- **Reminders** at a chosen time and weekday selection
- **Escalating nudges** when you miss a day — fired once, after 9am
- **Sunday weekly digest** push notification
- **Quick-log from notification** — tap "✓ Done" on binary goals without opening the app
- **Calendar heatmap** (GitHub-contributions style) for the last 6 months
- **Trend chart** per goal (line for daily, bar for weekly/monthly)
- **24-hour edit lock** on past entries — keeps history honest
- **Export** all data as JSON or CSV
- **Dark mode** with system-preference auto-detect
- **Command palette** (⌘K / Ctrl+K) for jump-to-goal and quick actions
- **PWA** — installs to phone home screen, push works on Android and iOS 16.4+

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · Drizzle ORM · Postgres (`pg`) · iron-session · web-push · Recharts

---

## Local development

```bash
npm install
cp .env.example .env.local      # fill in vars below
npm run db:migrate              # apply schema to Postgres
npm run dev
```

Required env vars (see `.env.example`):

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/reminders
APP_PASSWORD=pick-anything-strong
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
VAPID_PUBLIC_KEY=...          # generate with: npm run vapid:gen
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
CRON_SECRET=...                # any random string
APP_TIMEZONE=America/New_York
```

Visit http://localhost:3000, log in, create a goal, enable push from Settings.

---

## Deploy to Unraid (Docker + Cloudflare Tunnel)

This is the production setup: Postgres + the app in Docker on Unraid, Cloudflare Tunnel for HTTPS, Unraid's User Scripts plugin for cron.

Two ways to run the containers — pick one:

- **`docker compose`** (steps below) — everything in one file, single command to start/stop.
- **Unraid Docker UI** — see [`unraid/templates/README.md`](unraid/templates/README.md) for installable XML templates that show up in Unraid's "Add Container → Template" dropdown.

Both use the same image, same Postgres data dir, and the same env vars — switching later is just `docker compose down` and re-creating from the templates (or vice versa).

### 1. Clone to appdata

On the Unraid console (or via SSH):

```bash
mkdir -p /mnt/user/appdata/reminders
cd /mnt/user/appdata/reminders
git clone https://github.com/YOU/reminders-app-web.git app
cd app
```

### 2. Generate secrets

```bash
# 32+ char session secret
docker run --rm node:20-alpine node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# VAPID keypair for Web Push
docker run --rm -v "$PWD":/work -w /work node:20-alpine sh -c "npm install --no-save web-push && node scripts/gen-vapid.mjs"

# Cron bearer token
docker run --rm node:20-alpine node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

### 3. Configure environment

```bash
cp .env.docker.example .env
nano .env       # paste the values you just generated
```

### 4. Set up the Cloudflare Tunnel

1. In **Cloudflare Zero Trust dashboard → Networks → Tunnels**, click **Create a tunnel** → **Cloudflared**.
2. Name it (e.g. `reminders`), copy the **connector token** shown after install.
3. Paste it into `.env` as `CLOUDFLARE_TUNNEL_TOKEN=...`.
4. Still in the Cloudflare dashboard, under your tunnel's **Public Hostname** tab, add a route:
   - Subdomain + domain you control (e.g. `goals.example.com`)
   - **Service:** `HTTP` → `app:3000`
   - That hostname is now your app URL. Cloudflare handles TLS automatically.

### 5. Build and start

```bash
docker compose build
docker compose up -d
docker compose logs -f app     # watch migrations run then server start
```

The first start runs migrations (`drizzle/0000_init.sql`) against the Postgres container, then boots Next.js.

Visit your Cloudflare hostname. Log in with `APP_PASSWORD`. From your phone: "Add to Home Screen" first, then open the installed app and enable push from Settings.

### 6. Set up cron (Unraid User Scripts plugin)

Install the **User Scripts** plugin from Community Apps if you don't have it. Then for each of the two scripts in `unraid/`:

1. **Settings → User Scripts → Add New Script**, name it `reminders-app-reminders` (and later `reminders-app-digest`).
2. Click **Edit Script**, paste the contents of `unraid/user-script-reminders.sh` (or `user-script-weekly-digest.sh`).
3. Edit the two variables at the top:
   - `APP_URL="http://192.168.x.x:3000"` — your Unraid LAN IP (the User Scripts container talks to the app over LAN, not the Cloudflare hostname).
   - `CRON_SECRET="<paste the secret from your .env>"`
4. Click **Schedule Disabled** → **Custom**, then enter:
   - Reminders: `*/15 * * * *`
   - Weekly digest: `0 18 * * 0`
5. Save.

> **Note:** The User Scripts container reaches the app via LAN, so in `docker-compose.yml` change the `app.ports` line from `127.0.0.1:3000:3000` to `3000:3000` (LAN-bound) so User Scripts can hit it. Cloudflare Tunnel still works either way — it talks to the app over the internal Docker network.

### 7. Verify

```bash
# Trigger a reminder immediately
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders

# Or click "Send test" in the app's Settings page
```

### Updating

```bash
cd /mnt/user/appdata/reminders/app
git pull
docker compose build
docker compose up -d
```

The entrypoint runs `drizzle/` migrations automatically on each start, so schema changes apply on rebuild.

### Backup

The Postgres data lives at `/mnt/user/appdata/reminders/postgres`. Add it to your Unraid CA Backup / Restore Appdata plugin schedule, or `pg_dump` from outside:

```bash
docker exec -t reminders-db pg_dump -U reminders reminders > backup-$(date +%F).sql
```

### Restore

```bash
cat backup-2026-05-18.sql | docker exec -i reminders-db psql -U reminders -d reminders
```

---

## How it works

- **Auth** — one password (`APP_PASSWORD`), checked in `src/app/api/auth/login/route.ts`. On success, an encrypted iron-session cookie is set. `src/middleware.ts` gates every page except `/login` and the cron endpoints (which use `CRON_SECRET`).
- **Streaks** — `src/lib/cadence.ts` buckets entries by period (day/week/month) and counts consecutive periods where the goal hit its target. Paused goals don't break streaks.
- **Reminders** — User Scripts hits `/api/cron/reminders` every 15 minutes. Each goal has `remindAtMinutes` (0–1439 in local time) and `remindDaysMask` (bit per weekday). If now falls within the 15-min window and the goal's not yet hit for its current period, it sends a push. Sent reminders are logged in `reminder_log` to prevent duplicates.
- **Push** — `web-push` library with VAPID. The service worker (`public/sw.js`) shows the notification and handles the "Done" action by POSTing to `/api/entries`.
- **24h edit lock** — entries created more than 24h ago can't be edited unless the entry is for today. Enforced in `/api/entries` POST.
- **Migrations** — Drizzle generates SQL files into `drizzle/`. The container entrypoint (`docker-entrypoint.sh`) runs `scripts/migrate.mjs` on every start. Idempotent.

## Keyboard shortcuts

- `⌘K` / `Ctrl+K` — command palette
- `n` — new goal
- `g` — go to goals list
- `?` — open palette with help

## Customizing

- **Cron interval** — change the User Scripts schedule and update the `WINDOW` constant in `src/app/api/cron/reminders/route.ts` to match.
- **Timezone** — change `APP_TIMEZONE` in `.env` and `docker compose up -d`. All date math runs in this zone.
- **Theme colors** — `src/app/globals.css` `:root` and `.dark` CSS variables.
- **Schema changes** — edit `src/lib/schema.ts`, then locally run `npm run db:generate` to produce a new SQL file in `drizzle/`. Commit it. The next deploy applies it.

## Troubleshooting

- **`migrate` fails on first start** — check `docker compose logs postgres` for healthcheck failures. Confirm `POSTGRES_PASSWORD` matches between the two services (compose interpolates it from `.env`).
- **Push doesn't fire** — Settings page shows your subscription status. If `permission: granted` but no notifications, run the curl test command above and check `docker compose logs app` for VAPID errors.
- **Cloudflare 1033 / no DNS** — the tunnel's public hostname route in the CF dashboard must be saved before traffic flows. Run `docker compose logs cloudflared` and confirm "Registered tunnel connection".
- **Cron not firing** — the User Scripts plugin shows the last run output. Confirm `APP_URL` resolves from inside the Unraid host (User Scripts run on the Unraid OS, not inside Docker).

## Notes

- The PWA icon is currently an SVG; if you need PNGs for older platforms, place `icons/icon-192.png` and `icons/icon-512.png` in `public/` and update `manifest.json`.
- iOS push requires the app to be installed to home screen (PWA mode). Once installed, it works the same as Android.
- The `pg` driver is used (not `@neondatabase/serverless`) so the same image works with both local Postgres and any standard hosted Postgres if you ever switch.
