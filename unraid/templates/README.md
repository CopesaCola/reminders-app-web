# Unraid Docker tab — pure UI install

Install everything through Unraid's Docker tab — no SSH, no `docker compose`, no manual builds.

## What gets installed (4 containers)

| Container | Template | Purpose |
|---|---|---|
| `reminders-postgres` | `reminders-postgres.xml` | Postgres 16 database |
| `reminders-app` | `reminders-app.xml` | The Next.js app |
| `reminders-cron` | `reminders-ofelia.xml` | Fires reminders + weekly digest on schedule |
| `cloudflared` | (from Community Apps) | HTTPS tunnel — install the official template |

## One-time GitHub setup (~2 min)

The app image is published to **GitHub Container Registry (GHCR)** by the included GitHub Actions workflow at `ghcr.io/copesacola/reminders-app:latest`.

1. After the first push to `main`, watch the workflow at https://github.com/CopesaCola/reminders-app-web/actions. Wait ~2 minutes for it to build and push the image.
2. **Make the image public** so Unraid can pull it without credentials:
   - Go to https://github.com/CopesaCola?tab=packages
   - Click `reminders-app` → **Package settings** (right sidebar).
   - **Change package visibility** → **Public** → confirm.

Future pushes to `main` rebuild and republish automatically; Unraid will pull the latest when you click "Force update".

## Unraid setup

### 1. Create the shared Docker network

Unraid → **Docker → Network → Add Network**:
- Name: `reminders`
- Driver: `bridge`
- Click **Apply**.

All four containers will attach to this network so they can reach each other by container name.

### 2. Drop the templates where Unraid can find them

On your Unraid box (Tools → Web Terminal, or SSH if you have it), run:

```bash
mkdir -p /boot/config/plugins/dockerMan/templates-user
cd /boot/config/plugins/dockerMan/templates-user
wget https://raw.githubusercontent.com/CopesaCola/reminders-app-web/main/unraid/templates/reminders-postgres.xml
wget https://raw.githubusercontent.com/CopesaCola/reminders-app-web/main/unraid/templates/reminders-app.xml
wget https://raw.githubusercontent.com/CopesaCola/reminders-app-web/main/unraid/templates/reminders-ofelia.xml
```

> If you'd rather skip the terminal entirely, in **Docker → Add Container**, paste each XML's raw GitHub URL into the **Template** field at the top. Unraid will fetch and populate the form.

### 3. Add the containers in order

In Unraid → **Docker → Add Container → Template** dropdown:

**a) reminders-postgres**
- Set `POSTGRES_PASSWORD` to a long random string. Save it — you'll need it in the next step.
- Leave everything else at defaults.
- Click **Apply**.

**b) reminders-app**
- **DATABASE_URL:** replace `CHANGEME` with the postgres password from step (a). The hostname `reminders-postgres` stays.
- **APP_PASSWORD:** your login password.
- **SESSION_SECRET:** 32+ char random hex. Generate from Unraid terminal:
  ```bash
  docker run --rm node:20-alpine node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **VAPID keys:** generate the pair:
  ```bash
  docker run --rm node:20-alpine sh -c "npm install -g web-push && web-push generate-vapid-keys"
  ```
  Paste public and private separately.
- **CRON_SECRET:** any random string.
- **APP_TIMEZONE:** IANA timezone, e.g. `America/New_York`.
- Click **Apply**. Watch logs — first start runs migrations, then serves on `:3000`.

**c) reminders-cron**
- Set `TZ` to match the app's `APP_TIMEZONE`.
- Nothing else to configure.
- Click **Apply**. Ofelia immediately discovers the app container's schedule labels and starts firing on schedule.

**d) cloudflared** (separately, from Community Apps)
- Install the official `cloudflared` template.
- Paste your Cloudflare Tunnel connector token (from Cloudflare Zero Trust → Networks → Tunnels).
- In the Cloudflare dashboard, add a public hostname route: `HTTP` → `reminders-app:3000`.

### 4. Verify

- Open `https://<your-hostname>` (the one you configured in Cloudflare) — log in.
- In Settings, click **Enable push** then **Send test**. You should see a notification.
- `docker logs reminders-cron --tail 50` (or use the Unraid log icon on the container) — should show "scheduler started" and per-run lines on schedule.

## Updating

In Unraid → Docker tab → click the **reminders-app** container → **Force update**. Unraid pulls the new image from GHCR. The entrypoint runs new migrations automatically.

The Ofelia and Postgres containers rarely need updates — when there's a new image, the same Force update button works.

## Backup

The Postgres data is at `/mnt/user/appdata/reminders/postgres`. Add it to the **CA Backup / Restore Appdata** plugin schedule, or run an occasional `pg_dump`:

```bash
docker exec -t reminders-postgres pg_dump -U reminders reminders > backup-$(date +%F).sql
```

## Troubleshooting

- **"image manifest unknown"** when adding reminders-app — your GHCR package is still private. Repeat step 2 of the GitHub setup (make package public).
- **App container restart-looping** — check Docker logs. Most common: `DATABASE_URL` password doesn't match `POSTGRES_PASSWORD` on the postgres container.
- **Cron not firing** — Docker logs on `reminders-cron` should show the schedule lines on startup. If it says "no containers matched", the Ofelia container started before the app container had its labels. Restart Ofelia.
- **Force update doesn't pull a new image** — Unraid caches the image manifest. From the terminal: `docker pull ghcr.io/<your-username>/reminders-app:latest && docker restart reminders-app`.
