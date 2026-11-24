# Internal tools platform `intern.ffneumarkt.at`: design

Status: approved 2026-10-29, implemented through phase 3; see
`docs/superpowers/STATUS.md` for the current state and next steps. Updated 2026-10-29 with the
decisions made during phase 1 (layout, logging, versions, record use details) and 2026-10-30 with
those of phases 2 and 3 (settled rules, immutable history, member deactivation, passkey confirmation,
rate limits, CI split) and 2026-10-31 with the design of phase 4 (notifications checked every minute,
quiet time per user, device subscriptions).

## 1. Goal

A small internal web app for the fire brigade, separate from the public website `ffneumarkt.at`,
installable as one PWA with its own icon. It hosts two tools:

1. **Beförderungspapier**: the transport document generator for compressed-air cylinders, moved here
   from the public website. Public, no login, works fully offline.
2. **Material**: check interval management for equipment (e.g. breathing masks): items, check types,
   uses and checks, due dates, push notifications and barcode scanning.

### Why a separate app

- iOS uses only the root `/apple-touch-icon.png` of an origin for home screen icons and ignores
  `<link rel="apple-touch-icon">`. Two apps with two icons on one origin are impossible on iOS, so the
  generator needs its own origin to have its own icon.
- The material tool needs a database, login and push notifications, which do not belong in the static
  public website.

### Users

At most ~5 people. Typically one person does the checks for a category. Up to ~5 people record uses
through a **shared generic account** on a station device (a Microsoft Surface). The admin creates all
accounts.

### Out of scope

Offline use of the material tool, attachments (files on checks or items), lending or "temporarily out
of service" states, notifications for single items, email notifications, in-app user management,
native store apps.

## 2. Architecture

```
Browser / installed PWA (Ionic React)
        │ HTTPS
Cloudflare ── tunnel ── cloudflared container
                              │ http://intern:8090
                        intern container (one Go binary)
                        ├─ PocketBase core: auth, REST API, collection rules, admin UI (/_/), cron
                        ├─ embedded frontend (go:embed backend/ui/dist), served at /
                        ├─ internal/passkey   WebAuthn registration and login → PocketBase auth token
                        ├─ internal/due       due date calculation (pure functions, no DB access)
                        ├─ internal/material  record hooks and the due list route
                        ├─ internal/notify    job every minute: due items × notification settings → messages
                        ├─ internal/push      Web Push sending (VAPID), removes expired subscriptions, push routes
                        ├─ internal/snapshot  consistent gzipped copy of data.db to stdout
                        └─ migrations/        collections, rules, indexes (Go migrations)
                              │
                        /pb_data on a VPS volume (data.db, auxiliary.db)
```

### Stack

- **Backend:** Go 1.27, with PocketBase imported as a library and extended with own code (v0.40.6 is
  the newest published tag as of 2026-10-29; the docs site already shows v0.41.1). SQLite is the only
  database. Web Push via `github.com/SherClockHolmes/webpush-go`, WebAuthn via
  `github.com/go-webauthn/webauthn`.
- **Logging:** `github.com/charmbracelet/log` (user requirement), created in `internal/logging` with
  `ReportCaller: true`, `ReportTimestamp: true`, `TimeFormat: "15:04:05.00"`, level from the
  `LOG_LEVEL` env var (`debug|info|warn|error`, default `info`). All own code logs through it.
  PocketBase's own logs are not routed through it yet (open follow-up).
- **Frontend:** React 19, Ionic React 9 with `@ionic/react-router` and **react-router 6** (Ionic 9
  requires `>=6.4 <7`), Vite 8, TypeScript 7, `vite-plugin-pwa` (Workbox), Vitest + Testing Library,
  PocketBase JS SDK, `@simplewebauthn/browser` (passkeys), pdf-lib (generator), `barcode-detector` (scanning). UI text is **German only**.
- Vite builds the frontend into `backend/ui/dist`, which `backend/ui` embeds. `CGO_ENABLED=0`.

### Unit responsibilities

| Unit | Does | Depends on |
|---|---|---|
| `internal/due` | Computes due dates for an item from its category, check types, checks and uses | nothing (plain structs in, structs out) |
| `internal/material` | Record hooks (check status, default check type, validation, deactivation), `GET /api/material/due` and the loader that gives items their due dates | PocketBase app, `due` |
| `internal/notify` | Takes items and due dates from `material`, applies notification settings, timings and quiet time, deduplicates, hands grouped messages to a sender | PocketBase app, `due`, `material`, a `Sender` interface |
| `internal/push` | Implements `Sender` with Web Push; deletes subscriptions answered with 404/410; routes for the public key, subscribing and a test push; `intern vapid` | `webpush-go`, VAPID keys from env |
| `internal/passkey` | Custom routes for passkey registration and login | PocketBase app, `go-webauthn` |
| `internal/snapshot` | `intern snapshot` subcommand | SQLite (via PocketBase's DB) |
| `migrations/` | Schema, rules and indexes | PocketBase |

### Repository layout

Chosen by the user: Go code in `backend/`, frontend in `web/`, only tooling at the root.

```
backend/
  go.mod             # module github.com/ffneumarkt/intern/backend
  cmd/intern/        # main.go: PocketBase app setup, route and cron registration, subcommands
  cmd/seed/          # sample data for development, not part of the image
  internal/server/   # RegisterFrontend: SPA serving next to /api and /_/
  internal/logging/  # charmbracelet/log setup
  internal/          # due, material, notify, push, passkey, snapshot, devseed, testenv
  migrations/        # PocketBase Go migrations
  ui/                # embed.go + dist/ (Vite output; dist/.gitkeep keeps the embed valid)
web/                 # Ionic React + Vite app
  src/pages/         # one file per screen
  src/components/    # shared components (Page, ItemRow, DueStateBadge)
  src/api/           # PocketBase client, auth and material calls; replaced by fakes in tests
  src/test/          # Vitest setup, Ionic test helpers, fakes and fixtures
Dockerfile           # node → go → distroless/static, source label links the GHCR package
compose.yaml         # reference compose file for the VPS
Makefile             # dev-api, dev-web, debug, seed, test, build, image, run
deploy/              # (later) systemd units, backup wrapper script, authorized_keys example
.github/workflows/   # web.yml, go.yml, security.yml, image.yml
docs/superpowers/    # specs, plans, STATUS.md
```

## 3. Data model

All collections are PocketBase collections created by Go migrations. `?` marks optional fields.

| Collection | Fields | Notes |
|---|---|---|
| `users` (auth) | name, email, password, `deactivated` (bool) | PocketBase auth collection; email + password login enabled; deactivated instead of deleted, see section 4 |
| `categories` | name, `max_service_life_years`? (number) | e.g. "Masks" |
| `permissions` | user → users, category → categories, level (`use` \| `check` \| `manage`) | unique index on (user, category) |
| `check_types` | category → categories, name, `interval_months`? (number), `after_use` (bool), `is_default` (bool), `also_satisfies` → check_types (multiple) | at least one trigger required; `also_satisfies` only targets check types of the same category (validated in a hook); at most one default per category (a hook clears the previous one) |
| `items` | category → categories, name (e.g. inventory number), serial?, `barcode`? (unique when set), `manufactured_on`? (date), status (`active` \| `defective` \| `retired`), note? | |
| `uses` | item → items, date, kind (`operation` \| `exercise` \| `other`), `recorded_by_name`?, note?, created_by → users | |
| `checks` | item → items, check_type → check_types, date, result (`passed` \| `defect` \| `retired`), performed_by → users, note? | |
| `notification_settings` | user → users, category → categories, timings (JSON array of days before due, e.g. `[14, 3, 0]`), `weekly_overdue` (bool) | unique on (user, category); a hook allows only whole numbers from 0 to 90, without repeats |
| `notification_preferences` | user → users, `quiet_from`?, `quiet_until`? (`HH:MM`) | unique on user; separate from `users` because logged-in users can read each other's user records; a hook requires both times or neither, and that they differ; both empty means no quiet time; no row means 22:00 to 07:00 |
| `push_subscriptions` | user → users, endpoint (unique), p256dh, auth, device_label | device_label holds the browser's user agent |
| `passkeys` | user → users, credential_id (unique), public_key, sign_count, aaguid?, name, `backup_eligible` (bool), `backup_state` (bool), created | |
| `notification_log` | user → users, item → items, reason (`check:<check_type id>` \| `end_of_life` \| `defect`), due_date, timing (days before, or `overdue`), sent_on | dedupe key (user, item, reason, due_date, timing, sent_on) |
| `transport_document_settings` | station name, station address (street, postal code, town), cylinder label, cylinder litres in tenths, points limit, filling station (name, street, postal code, town), checklist (JSON array of strings) | single record |

### Status side effects (hooks on `checks` create)

- `passed`: if the item is `defective`, set it to `active`.
- `defect`: set the item to `defective`.
- `retired`: set the item to `retired`.

Items can also be retired by hand (level `check` or higher). Retired items keep their history, are
hidden from lists by default and take no new uses or checks, otherwise a `defect` check would bring
one back. `status` changes by hand only to `retired`. An item's category cannot change through the
API. Uses and checks cannot be edited or deleted through the API; superusers correct them in `/_/`.
They cannot be dated in the future. An item with uses or checks cannot be deleted, not even by a
superuser, only retired; initial "last checked on" checks count as history.

## 4. Permissions

No roles. Each user has at most one permission per category:

| Level | Allows |
|---|---|
| `use` | see the category's items, due dates and history; record uses |
| `check` | `use` + record checks, retire items |
| `manage` | `check` + create, edit and delete items (only without history) and check types |

- No permission row means the category is invisible to that user.
- The admin is a PocketBase **superuser** and manages users, categories, permissions, notification
  settings of others and `transport_document_settings` in the PocketBase admin UI (`/_/`). There are no
  admin screens and no admin flag in the app.
- The shared station account has `use` level.
- All rules are enforced by PocketBase collection rules, each with an API test, e.g. the permission
  part of the `checks` create rule:
  `@collection.permissions.user ?= @request.auth.id && @collection.permissions.category ?= item.category && (@collection.permissions.level ?= "check" || @collection.permissions.level ?= "manage")`.
  All `@collection.permissions` conditions in a rule match the same row; `?~` is a LIKE, not a regex.
- Public registration and self-deletion, which PocketBase allows by default, are closed. Logged-in
  users can view other users' names (not emails) for the history.
- **Deactivating a member:** the admin sets `deactivated` in `/_/`. Login and token refresh fail like a
  wrong password, and existing tokens stop working at once. Permissions, uses and checks stay, and
  clearing the flag restores the account. Users with history cannot be deleted. Passkey login (section
  5) and notifications (section 7) must honour the flag.
- `transport_document_settings`: list and view public, write superuser only.
- Users manage only their own `notification_settings`, `notification_preferences`,
  `push_subscriptions` and `passkeys`.

## 5. Authentication

- **Passkeys first, email + password as fallback.** Deactivated users cannot log in by either way. PocketBase v0.41.1 has no WebAuthn support
  (checked 2026-10-29), so passkeys are custom code.
- Routes in `internal/passkey`:
  - `POST /api/passkey/confirm/begin` and `/finish` (authenticated): proves the user is at this session
    and returns a single-use grant, valid 5 minutes. The first passkey needs the password; further ones
    need an existing passkey, so a password alone never adds a second one. The server decides which.
  - `POST /api/passkey/register/begin` and `/finish` (authenticated): `begin` needs a grant; adds a
    credential to `passkeys`.
  - `POST /api/passkey/login/begin` and `/finish` (public): discoverable credentials, no username. On
    success it returns the same response as a password login (token + user record), so the JS SDK
    stores it in its auth store as usual.
  - WebAuthn session data between begin and finish is kept in memory with a 5-minute expiry.
- Relying party ID `intern.ffneumarkt.at`, origin `https://intern.ffneumarkt.at`, overridden with
  `PASSKEY_RP_ID` and `PASSKEY_ORIGIN` (comma separated). WebAuthn does not accept an IP address, so
  local development runs on `http://localhost:5173`.
- The backup flags are stored because go-webauthn compares them on every login: without them a synced
  iCloud or Google passkey fails on its second use.
- A user who lost their only passkey removes it under Settings, after which the password confirms a
  new one. Removing needs no confirmation and does not end sessions: tokens stay valid until they
  expire or the password changes.
- User verification is left to the device (`preferred`); no second factor is forced.
- Rate limits, per client IP (`CF-Connecting-IP` behind the tunnel; the container publishes no port, so
  only Cloudflare can set it): 5 password logins and 5 `confirm/finish` per minute, each counted
  separately, 30 requests per minute on `/api/passkey/login/`, and 5 test pushes per minute (section
  7). Only these routes are limited.
- All login failures answer alike; the reason goes to the log. A user may remove their last passkey,
  since the password still works.
- Flow: the admin creates the account with a password; the user logs in once with it and adds one or
  more passkeys under Settings (rename, remove). The login screen shows "Sign in with passkey" first,
  password below.
- The sign count is updated on each login; a sign count regression rejects the login. Synced passkeys
  report 0 every time, which is not a regression.
- Tokens are PocketBase's stateless JWTs; logout clears the local auth store. The app calls
  `authRefresh()` on start.

## 6. Due dates

Computed by `internal/due` for one item at a time. Dates are calendar dates in Europe/Vienna.

For each check type of the item's category:

1. **Last relevant check:** the latest `passed` check of this type or of any check type whose
   `also_satisfies` contains this type (one level, not transitive).
2. **Interval due** (if `interval_months` is set): last relevant check date + `interval_months`.
3. **After-use due** (if `after_use`): the date of the first use after the last relevant check. A check
   after use is due on the day of the use, with no grace period.
4. **Due date:** the earlier of 2 and 3; none if neither applies.
5. **No relevant check at all:** due on the item's creation date. The item form offers an optional
   "last checked on" date per check type, which creates an initial `passed` check so existing equipment
   does not start out overdue.

Per item:

- **End of life** (if `manufactured_on` and the category's `max_service_life_years` are set):
  `manufactured_on` + `max_service_life_years`. Reaching it does not retire the item; it stays an
  overdue task until someone retires it.
- **Defective:** due on the date of the defect check, regardless of check types.
- **Retired:** nothing is due.

A check on the same day as a use counts as after the use.

List states, by the earliest due date of an item:

| State | Condition |
|---|---|
| overdue | due date before today |
| due today | due date is today |
| due soon | due within the next 14 days |
| OK | otherwise |

The frontend shows the same states; due dates for lists come from a custom route
`GET /api/material/due?category=…` that runs `internal/due` server side and respects permissions, so
the logic exists only once.

## 7. Notifications

- **The job runs every minute** (PocketBase cron), so nothing depends on it running at one exact time,
  and it needs no timer or startup catch-up. Runs do not overlap. All times are Europe/Vienna.
- Each run looks at every active user with at least one subscription and each of their
  `notification_settings` (only categories they have permission for):
  1. **In the user's quiet time:** skip the user. What was held back goes out on the first run after
     it ends. Quiet time may cross midnight.
  2. **At any time outside quiet time:** a due date that is today or past fires if 0 is in `timings`
     and it has never fired for this user, item, reason and due date (timing `0`, any `sent_on`). This
     is the immediate push: a use, a `defect` check or a new item with no check is reported within a
     minute, because the job at a fixed hour would only see it as already overdue.
  3. **From 07:00, also:** a due date fires when it is exactly N days away for an N in `timings` with
     N > 0, and, if `weekly_overdue`, on every 7th day after the due date while it is overdue (timing
     `overdue`).
- Timings and weekly reminders not sent by the end of their day are dropped, for example while the
  server is down or when quiet time lasts until the next day. Rule 2 is not lost this way, since it has
  no fixed day.
- A user who first subscribes, or adds 0 to `timings`, gets one push with everything rule 2 finds.
- **One grouped push per user per run**, one line per category, e.g. „Masken: 2 überfällig, 1 heute
  fällig“. Each item counts once, under its most urgent state: `überfällig`, `heute fällig`,
  `bald fällig`. Tapping it opens the due list filtered to the affected items,
  `/material?geraete=<id>,<id>`; with more than 50 items it opens the plain due list, to stay within
  the size limit of a push message. A run can split one use form into two pushes, which is accepted.
- `notification_log` records every fired (user, item, reason, due date, timing, day), written only
  after at least one device accepted the message, so a repeated run sends nothing new and a failed
  delivery is retried by the next run. A unique index conflict counts as already sent.
- The message goes to all of the user's `push_subscriptions`. Subscriptions answered with 404 or 410
  are deleted. A user without a working subscription gets nothing. No email fallback.
- **Device subscriptions:** `POST /api/push/subscribe` (authenticated) creates or takes over the
  subscription with that endpoint, because a browser keeps its endpoint when another user logs in and
  the endpoint is unique. Knowing the endpoint proves being on that device. The app syncs an existing
  subscription on start. Logout deletes this device's row and unsubscribes the browser, so the next
  person on the device does not receive the previous user's pushes.
- **Test push:** `POST /api/push/test` (authenticated, section 5 limit) sends a fixed message to the
  user's own subscriptions. It ignores quiet time and writes nothing to `notification_log`.
- Web Push works on Android and desktop browsers, and on iOS 16.4+ only when installed to the home
  screen.
- VAPID keys come from environment variables (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`); the public key is exposed to the frontend via the public route
  `GET /api/push/key`. `intern vapid` prints a new key pair, since the image has no openssl. Without keys
  the server logs a warning at startup, the job is not scheduled, the key route answers 404 and Settings
  says that push is not set up.

## 8. Frontend

Ionic tabs; tabs appear only when they apply to the logged-in user.

| Screen | Who | Content |
|---|---|---|
| Start | everyone | Tool tiles: Beförderungspapier (always), Material (logged in); login |
| Beförderungspapier | public, offline | Generator rebuilt with Ionic components; `calc.ts`, `fillForm.ts` and their tests are copied unchanged from `ffneumarkt-web/src/components/features/transportDocument/` |
| Due list | `use`+ | Home of the material tool (rows have a „Prüfen“ button for `check`+ users that opens the check form of that item directly; back and saving return to the list): overdue, due today, due soon across permitted categories; category filter. `?geraete=<ids>` limits it to those items, with an "Alle anzeigen" chip that clears the filter; items that are still "ok" but due within 90 days (the longest reminder lead time) are shown under „Demnächst“ then, so a reminder weeks ahead never opens an empty list |
| Category → items | `use`+ | Items with state badge; retired items hidden behind a show/hide button |
| Item detail | `use`+ | Due date per check type, end of life, combined history of checks and uses; the two main actions „Prüfung erfassen“ (`check`+) above „Verwendung erfassen“ are equal solid buttons in the bar at the bottom, Bearbeiten and Ausscheiden are smaller actions in a row |
| Record use | `use`+ | Scan loop (section 9), then one form: date (today), kind, "recorded by" (prefilled with the remembered name of this account on this device, else the account's own name), note; saves one use per item. Opened from an item's detail page via `/material/verwendung?geraet=<id>`, it starts with that item in the list |
| Record check | `check`+ | Check type (preselects the category's default, else the first), date, result, note |
| Manage | `manage` | Create and edit items (incl. "last checked on" per check type) and check types (incl. the category's default) |
| Settings | logged in | Notification settings per category (chips for 30, 14, 7, 3, 1 and 0 days, weekly reminder; other values up to 90 only in `/_/`; new rows default to `[14, 3, 0]` with the reminder on), quiet time once per user (toggle, from, until), push on this device with a test button (iOS outside home screen: "Add to Home Screen first" guide), passkeys, logout |

### Service worker

`vite-plugin-pwa` keeps generating the worker. Its `workbox.importScripts` loads a small handwritten
`web/public/push-sw.js` with the `push` and `notificationclick` handlers. A tap focuses an open window
and navigates it, otherwise it opens a new one.

### Offline and caching

- The app shell and the Beförderungspapier (incl. pdf-lib and the PDF template) are precached.
- `transport_document_settings` is fetched network-first and cached, so the generator works offline
  with the last loaded values.
- The material tool requires a connection and shows an offline notice instead of stale data.

## 9. Barcode scanning

- Codes are the manufacturers' own; the system prints no labels and generates no codes (refined in
  `2026-11-24-barcode-scanning-design.md`, which wins where they differ). `items.barcode` takes any
  string. Supported formats: QR, DataMatrix, Code 128, EAN-13/8.
- Camera only (no handheld scanner). The station device is a Microsoft Surface with a built-in camera.
- Library `barcode-detector` (zxing-wasm based); native `BarcodeDetector` is missing on iOS Safari and
  on Windows desktop browsers, so the library is always used.
- Scanner component: camera picker (defaults to the rear/environment camera, choice remembered per
  device in localStorage), torch toggle where supported, manual code entry as fallback.
- Record use flow: scan → item found → added to the list (vibration where supported) → "Scan another?"
  → … → "Done" → form. A code already in the list is ignored. An unknown code shows "Not found"; users
  with `manage` level can assign it to an item.
- **Live suggestions while typing a code manually:** as soon as text is entered, a list shows active
  (not retired) items whose code or name contains the text, case-insensitive, excluding items already
  in the list (e.g. `M-00` offers Maske 01–05). Tapping a suggestion adds the item and clears the
  input. Enter with an exact code still adds directly. Names stay in the match and the list has no cap.
- Scanning from the material tab works as quick search and opens the item.

## 10. Build, deploy, backup

### CI (GitHub Actions)

- One workflow per concern in `.github/workflows/`: `web.yml` (`vitest`, `tsc --noEmit`), `go.yml`
  (`go vet`, `go test ./...`), `security.yml` (`govulncheck`, `npm audit` at level high) and `image.yml`.
- `web.yml` and `go.yml` run on pull requests that touch their code. `image.yml` builds on every pull
  request without pushing. On `main` it calls `web.yml` and `go.yml` first, so no image is pushed
  without passing tests.
- `security.yml` is not required for the image, so a new advisory does not block a release.
- A newer push cancels a running build of the same workflow and branch or PR, on `main` too, so a
  superseded commit may get no SHA tag.
- Changes that only touch `docs/**`, `*.md` files or `LICENSE` start none of these, so docs PRs show no
  checks and docs commits on `main` build no new image.
- `main`: multi-stage Dockerfile (Node build → Go build → `gcr.io/distroless/static`, runs as root so
  the bind-mounted `./data` needs no special ownership), pushed to GHCR as `ghcr.io/ffneumarkt/intern`
  with tags `latest` and the commit SHA. `packages: write` is granted only to the `image` job. The image
  contains no secrets, only the binary with the embedded frontend.
- The package is **public** (switched on 2026-10-29; anonymous pull verified) and linked to the repo
  via the `org.opencontainers.image.source` label, so the VPS pulls without a login.

### VPS

- Docker Compose project with services `intern` (volume `./data:/pb_data`) and its own `cloudflared`
  (tunnel token in `.env`). The tunnel's public hostname `intern.ffneumarkt.at` points to
  `http://intern:8090`.
- `.env` on the VPS holds the tunnel token and VAPID keys. PocketBase creates its superuser and keys on
  first start.
- A systemd timer runs `docker compose pull && docker compose up -d` every 5 minutes. Rollback: pin the
  previous SHA tag in `compose.yaml`.

### Backup

- `intern snapshot` writes a consistent copy of `data.db` (`VACUUM INTO` a temporary file), streams it
  gzipped to stdout and deletes the temporary file. `auxiliary.db` (request logs) is not backed up.
- A dedicated `backup` user on the VPS: `authorized_keys` entry with
  `command="sudo /usr/local/bin/intern-backup",restrict`. The root-owned wrapper runs
  `docker compose -f /srv/intern/compose.yaml exec -T intern /intern snapshot`; the single sudo rule
  allows only this script. The backup user is not in the `docker` group.
- The NAS pulls nightly: `ssh backup@vps > intern-$(date +%F).db.gz`. Retention is handled on the NAS.
- Setup includes one restore test: start a container with a restored `data.db` and check the data.

## 11. Testing

- `internal/due`: table-driven tests for both triggers, `also_satisfies`, same-day check and use, no
  check yet, defect, end of life, retired.
- `internal/notify`: fake `Sender`; timings, the once-only rule, weekly overdue, the 07:00 limit, quiet
  time across midnight, grouping per user, deduplication, retry after a failed delivery, deactivated
  users, permission filtering.
- `internal/push`: public key, subscribing incl. taking over an endpoint, removal on 404/410, test
  push and its limit.
- Collection rules: API tests with users at each level, incl. the shared `use` account trying to
  record a check (must fail) and a user without permission (must see nothing).
- `internal/passkey`: registration and login flows with a software authenticator, sign count
  regression rejected.
- `internal/snapshot`: snapshot of a test database restores to identical data.
- Frontend: carried-over `calc.ts` and `fillForm.ts` tests; component tests for the scan loop, the
  record use form, the notification settings and the due list filter.

## 12. Follow-ups in `ffneumarkt-web`

1. Now: revert #10 so `/apple-touch-icon.png` serves the site icon again (production currently has no
   iOS icon).
2. At go-live: redirect `/atemschutz/befoerderungspapier` to
   `https://intern.ffneumarkt.at/befoerderungspapier`.
3. Afterwards: remove the generator page, its manifest, pdf-lib and the precache parts the public site
   no longer needs, and the `transportDocument` Keystatic singleton.
