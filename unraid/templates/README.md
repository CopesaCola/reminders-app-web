# Unraid Community Apps templates

Two Docker container templates for the Accountability app. They're an alternative to the `docker-compose.yml` workflow — pick one or the other, not both.

| File | What it is |
|---|---|
| `reminders-postgres.xml` | Postgres 16 container for the app |
| `reminders-app.xml` | The Next.js app container |

The Cloudflare Tunnel container is **not** included — install the official `cloudflared` template from Community Apps directly.

## When to use these vs `docker compose`

| Use templates if you want… | Use compose if you want… |
|---|---|
| Edit env vars / volumes through the Unraid Docker UI | Everything in one file, version-controlled |
| Standard Unraid update flow (the "Update Ready" banner) | One command (`docker compose up -d`) to start everything |
| Easy enable/disable of individual containers | Less clicking |

Both approaches use the same image, same Postgres data dir, same env vars — you can switch later without losing data.

## Install

### 1. Build the app image first

Templates point at a local image (`reminders-app:local`) that doesn't exist on Docker Hub. You build it on Unraid:

```bash
mkdir -p /mnt/user/appdata/reminders
cd /mnt/user/appdata/reminders
git clone https://github.com/YOU/reminders-app-web.git app
cd app
docker build -t reminders-app:local .
```

(Replace `YOU` with your GitHub username — same edit as in the XML `<Project>` and `<Icon>` URLs.)

### 2. Create the shared Docker network

The app and Postgres talk to each other by container name over a private network:

```bash
docker network create reminders
```

You only do this once.

### 3. Drop the templates where Unraid sees them

Copy both XML files to:

```
/boot/config/plugins/dockerMan/templates-user/
```

After copying, in the Unraid web UI go to **Docker → Add Container**. The "Template" dropdown at the top will now list `reminders-postgres` and `reminders-app`.

### 4. Add postgres first, then the app

Add **reminders-postgres** first:
- Set `POSTGRES_PASSWORD` to a long random string
- Leave the other defaults
- Click Apply

Add **reminders-app** second:
- Set `DATABASE_URL` — replace `CHANGEME` with the password you set above
- Set `APP_PASSWORD`, `SESSION_SECRET`, `VAPID_*`, `CRON_SECRET` (see the field descriptions for how to generate each)
- Click Apply

The container's entrypoint runs DB migrations automatically on first start; check **Docker → reminders-app → Logs** to confirm you see `[migrate] done`.

### 5. Cloudflare Tunnel + Cron

Same as the compose flow — see the main [README](../../README.md#deploy-to-unraid-docker--cloudflare-tunnel) sections **"Set up the Cloudflare Tunnel"** and **"Set up cron (Unraid User Scripts plugin)"**.

## Editing the templates

If you change `<Repository>` / `<Project>` / `<Icon>` URLs to your fork, edit both XML files and re-apply the containers (Unraid won't re-read the templates automatically once a container is created from them).
