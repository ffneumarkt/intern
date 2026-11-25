# Deploy to the VPS

## Which files do I need?

To run the app you need only two files in one folder (for example `/opt/ff`): `compose.yaml` (repo root) and `.env` (a
filled copy of `env.example`). Everything else here is optional:

| File | What for | Needed? |
|---|---|---|
| `../compose.yaml` | the app and its Cloudflare tunnel | **yes** |
| `env.example` → `.env` | settings and secrets (every variable is explained inside) | **yes** |
| `Makefile` | short commands on the server: `make update`, `make first-user ADMIN_EMAIL=...`, `make logs` (copy it next to `compose.yaml`) | convenience |
| `bootstrap-staging.sh` | does the whole first setup in one script: folder, `.env` with new keys, default setup, first admin, start | convenience, for a new environment |
| `intern-update.service`, `intern-update.timer` | systemd timer that pulls and restarts every 5 minutes (automatic updates) | optional |
| `intern-backup`, `intern-backup.sudoers`, `backup_authorized_keys.example` | nightly database backup pulled by a NAS over SSH | optional, recommended |
| `restore-test.sh` | checks a backup file by starting the image on it | optional |

Typical commands with the Makefile (run in the folder with `compose.yaml`):

```sh
make update                                              # pull the newest image and restart what changed
make first-user ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name"   # first admin, password printed once
make logs                                                # follow the logs
```

---

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

## Staging (or any new environment) in one script

```sh
ADMIN_EMAIL=chef@example.com TUNNEL_TOKEN=... deploy/bootstrap-staging.sh
```

It creates `/srv/intern-staging` (`STAGING_DIR`), writes `.env` with new VAPID keys, runs the migrations, adds the
default setup, creates the first admin (all admin areas, manage on every category; the password is printed once, or
set `ADMIN_PASSWORD`) and starts the app. Without `TUNNEL_TOKEN` there is no tunnel: the app is published on
`127.0.0.1:8090` (`STAGING_PORT`) instead. Running it again keeps `.env` and the data and only adds what is missing.
The same step without Docker or the admin: `intern bootstrap [--admin-email EMAIL --admin-name NAME]`.
Or let the app do the default setup itself: `APPLY_DEFAULTS=true` in `.env` adds it on the first start of an empty database
(no category yet); once a category exists it does nothing, so it can stay on. The first admin still needs
`intern bootstrap --admin-email EMAIL`.

The default setup is `backend/internal/defaults/defaults.json` (edit it to change the station's setup):
Atemschutzmasken (15 years; Maskenprüfung every 12 months, after a use, default, with measurements; 5-Jahres-Prüfung
every 60 months, also counts as a Maskenprüfung), Lungenautomaten (Jahresprüfung every 12 months, after a use) and the
locations RLF and LAST. The migrations already add the workshop location and the Beförderungspapier settings
(FF Neumarkt, 6,8 l bottles, 1000 points, Abfüllstation FF Grünbach, the checklist). No items or other members.

## First setup

1. Docker and the compose plugin on the VPS; `mkdir -p /srv/intern/data`.
2. Copy `compose.yaml` and fill `/srv/intern/.env`:
   - `TUNNEL_TOKEN`: in Cloudflare Zero Trust create a tunnel for this VPS, add the public hostname
     `intern.ffneumarkt.at` → `http://intern:8090`, copy the token.
   - VAPID keys: `docker run --rm ghcr.io/ffneumarkt/intern vapid`; `VAPID_SUBJECT` by hand.
3. `cd /srv/intern && docker compose up -d`. The image is public, no login is needed.
4. Create the first superuser: `docker compose exec intern /intern superuser upsert EMAIL PASSWORD`,
   make the first admin and the default setup: `docker compose exec intern /intern bootstrap --admin-email EMAIL --admin-name NAME`
   (or, for a user that already exists, `admin grant EMAIL members categories transport corrections`)
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
