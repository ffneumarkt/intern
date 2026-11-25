# Deploy to the VPS

Files for `intern.ffneumarkt.at` (design: spec §10). The VPS runs Docker Compose in `/srv/intern`
with the app and its own `cloudflared`; the container publishes no port, so `CF-Connecting-IP` (used
by the rate limits) can only come from the tunnel.

| File | Goes to |
|---|---|
| `../compose.yaml` | `/srv/intern/compose.yaml` |
| `env.example` | `/srv/intern/.env` (mode 0600, filled in) |
| `intern-update.service`, `intern-update.timer` | `/etc/systemd/system/` |
| `intern-backup` | `/usr/local/bin/intern-backup` (root:root, 0755) |
| `intern-backup.sudoers` | `/etc/sudoers.d/intern-backup` (0440) |
| `backup_authorized_keys.example` | `~backup/.ssh/authorized_keys` with the NAS key |
| `restore-test.sh` | run anywhere with docker, from a copy of a backup |

## First setup

1. Docker and the compose plugin on the VPS; `mkdir -p /srv/intern/data`.
2. Copy `compose.yaml` and fill `/srv/intern/.env`:
   - `TUNNEL_TOKEN`: in Cloudflare Zero Trust create a tunnel for this VPS, add the public hostname
     `intern.ffneumarkt.at` → `http://intern:8090`, copy the token.
   - VAPID keys: `docker run --rm ghcr.io/ffneumarkt/intern vapid`; `VAPID_SUBJECT` by hand.
3. `cd /srv/intern && docker compose up -d`. The image is public, no login is needed.
4. Create the first superuser: `docker compose exec intern /intern superuser upsert EMAIL PASSWORD`,
   Make the first admin: `docker compose exec intern /intern admin grant EMAIL members categories transport corrections`
   (`admin list` and `admin revoke` also exist; the last `members` holder cannot be revoked or deactivated).
   From then on members, permissions, categories, the transport settings and corrections are managed in the app
   (Einstellungen → Verwaltung); a new member gets a one-time setup link to pass on. The dashboard is not needed.
   The dashboard and PocketBase's admin API (superuser login, settings, backups, logs, schema) answer 404 to
   requests that come through the tunnel or any non-loopback address. To use the dashboard, set
   `ADMIN_API_ALLOW=true` in `.env`, `docker compose up -d`, and remove it again afterwards. Local access on the
   VPS (`curl http://127.0.0.1:8090` through an SSH tunnel to a published loopback port) needs no override.
5. Updates: `cp intern-update.* /etc/systemd/system/ && systemctl enable --now intern-update.timer`.
   Rollback: pin the previous SHA tag in `compose.yaml` instead of `latest`.

## Backup

1. `useradd --create-home --shell /bin/sh backup`; put `backup_authorized_keys.example` (with the NAS
   public key) in `~backup/.ssh/authorized_keys`, mode 0600.
2. Install `intern-backup` and `intern-backup.sudoers` as in the table, then
   `visudo -c -f /etc/sudoers.d/intern-backup`. The backup user is not in the `docker` group.
3. On the NAS, nightly: `ssh backup@VPS > intern-$(date +%F).db.gz`; retention is the NAS's job.
   Check once by hand that the file is not empty (`gzip -t`).
4. `intern snapshot` copies `data.db` only; `auxiliary.db` (request logs) is not needed.

## Restore test (once after setup, and after big changes)

`./restore-test.sh intern-2026-11-24.db.gz` checks SQLite's `integrity_check`, prints the number of
items and users, starts the image on the restored data and waits for `/api/health`. To restore for
real: stop the app, put the unpacked file in `/srv/intern/data/data.db`, start it.

## After the first deploy: check what cannot be tested locally

Passkeys on a real iPhone (Safari: two-tap confirmation), Android and Windows device; push on the same
devices (iOS only from the home screen); the rate limits count per client with real `CF-Connecting-IP`
traffic (everyone at the station shares one IP and so one budget); the Beförderungspapier PDF opens from
the installed PWA on iOS and Android and works in airplane mode; scanning with the real cameras
(phone, Surface) and offline from the installed PWA.
