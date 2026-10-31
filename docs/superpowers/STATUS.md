# Project status and handover

Last updated: 2026-10-31. Read this first, then the spec
(`specs/2026-10-29-intern-platform-design.md`), which is the binding design.

## Where things stand

- **Phase 1 done** (plan `plans/2026-10-29-basic-setup.md`, PR #1, merge `7204f2d`): Go + PocketBase
  skeleton serving the embedded frontend, German Ionic React UI sketch of all screens with mock data,
  Docker image, reference `compose.yaml`, Makefile, CI.
- CI on `main` pushes `ghcr.io/ffneumarkt/intern:latest` and `:<sha>`. The package is **public** and
  linked to the repo; anonymous pull verified.
- CI is one workflow per concern: `web.yml`, `go.yml`, `security.yml`, `image.yml`. On `main`,
  `image.yml` runs the web and Go tests before pushing; security findings do not block a release. A
  newer push cancels a running build of the same workflow and branch.
- **Phase 2 done** (plan `plans/2026-10-30-data-and-auth.md`, PR #3): all collections and rules, password
  login, `/api/material/due` with `internal/due`, status hooks, member deactivation, a default check type
  per category, every screen on real data, `web/src/sketch/` deleted, `make seed` for sample data.
- **Phase 3 done** (plan `plans/2026-10-30-passkeys.md`, PR #6): passkey login first with password as
  fallback, passkeys managed under Einstellungen.
- Since then: items with history can only be retired, not deleted (PR #4); adding a passkey needs the
  password, or an existing passkey for further ones (PR #7, no fresh review was run on it); rate limits
  on password checks and passkey login (PR #10). The licence is MIT (PR #8).
- **Phase 4 done** (plan `plans/2026-10-31-notifications.md`, PR pending): notification settings per
  category with timings, weekly overdue reminder and quiet time; `internal/notify` job every minute,
  `internal/push` sender and `/api/push/key|subscribe|test`, `intern vapid`; push service worker
  `web/public/push-sw.js`; the due list filters by the items of a push (`?geraete=`). Checked in headed
  Playwright Chromium against a real FCM endpoint: test push and a timing `0` push after a use arrived.
  Not observed: tapping the notification (the `?geraete=` link was only opened by hand), Firefox and
  Safari, iOS and Android devices. Headless Chromium cannot test push; headed Chromium did.
- Nothing is deployed to the VPS yet. No `deploy/` files exist yet.

## How the process works here

The user works with the superpowers skills: brainstorming → spec → writing-plans → execution, with
each phase getting its own plan in `docs/superpowers/plans/`. Commits end with a `Co-Authored-By`
line; work happens on branches with PRs against `main` (the user merges).

## Next steps (proposed order, each needs its own plan)

1. **Phase 5: camera scanning and QR labels** (spec §9, `barcode-detector`): camera picker and torch
   removed in phase 2, the label page's QR placeholder, assigning an unknown code to an item.
2. **Phase 6: Beförderungspapier port** from `ffneumarkt-web/src/components/features/transportDocument/`
   (`calc.ts`, `fillForm.ts` + tests unchanged), config from `transport_document_settings`, offline.
3. **Deploy:** `deploy/` (systemd update timer, backup wrapper, `authorized_keys` example),
   `intern snapshot` (spec §10), VPS setup with its own `cloudflared` and hostname
   `intern.ffneumarkt.at`, restore test. After the first deploy, check what can't be tested locally:
   passkeys on a real iPhone, Android phone and Windows device, including Safari with the two-tap
   confirmation, push on the same devices (iOS only from the home screen), and that rate limits count
   per client with real `CF-Connecting-IP` traffic. Everyone at the station shares one IP and so one
   budget. The container must keep publishing no port, or that header can be spoofed. Generate the VAPID
   keys with `docker run --rm ghcr.io/ffneumarkt/intern vapid`; `VAPID_SUBJECT` (a `mailto:` address or
   https URL) is set by hand.
4. **ffneumarkt-web follow-ups** (spec §12): revert #10 there now (production has no iOS icon), redirect
   and cleanup at go-live.

## Deferred minor findings (from the phase 1 review)

- `/_` and `/api` without trailing slash return the app shell (`internal/server/frontend.go`, Vite
  `navigateFallbackDenylist`).
- A stale tab requesting a removed hashed asset gets `index.html` (200) instead of 404.
- No Cache-Control or compression for frontend assets.
- PocketBase's own logs are not routed through charmbracelet/log, so `LOG_LEVEL` affects little yet.
- A failed Vite build leaves the tracked `backend/ui/dist/.gitkeep` deleted (`emptyOutDir`).
- JS bundle above Vite's 500 kB warning (code splitting later).
- CI warnings: docker actions still target Node 20; `ubuntu-latest` moves to Ubuntu 26.

From the phase 2 review:

- A lost response followed by a retry can duplicate one use; client-generated record ids would fix it.
- The new check type form does not clear after creating one.
- No way back from the record use form step to the list.
- Login while offline shows the wrong-password message.
- `internal/material/hooks.go` uses `go-ozzo/ozzo-validation`, not PocketBase's fork, so hook errors
  lose their field detail on the API.
- `Loaded` reports every error as "Keine Verbindung", including server faults.

From the phase 3 review:

- Many clients together can still flood `login/begin` and evict pending passkey ceremonies, including
  registrations; the limit of 30 per minute is per IP. The password still works.
- Concurrent logins can lose a sign count update.
- "angelegt am" shows the UTC date.
- Adding a passkey on a device that already has one once showed no message in a browser test (1 of 9
  full runs). 210 focused attempts did not reproduce it and the cause is unknown. Nothing is saved in
  that case; the click just has no visible effect.

From the phase 4 review:

- `intern vapid` bootstraps the app: it creates `pb_data` files and in dev mode prints SQL before the keys.
- `POST /api/push/subscribe` has no limit of its own: only PocketBase's global 32 MB body limit and the
  5000 character default of text fields apply.
- subscribe's lookup by endpoint treats any error as not found.
- Any https endpoint can be subscribed, so the server POSTs to internal HTTPS hosts (SSRF, low impact
  here); a host check could go in the endpoint hook. See also the missing cap on subscriptions below,
  which has the same fix.
- The quiet time and timing chips: `ion-chip` is not keyboard-operable.
- `enablePush` asks for permission before checking that the server has a key. Permission must stay
  first (Safari needs it inside the user gesture); bound the `serviceWorker.ready` wait instead.
- A failed `/api/push/key` hides the category settings too.
- The Settings push section waits up to 5 s for a service worker in dev (Vite registers none).
- The job's lookup of zero-timing history is unbounded over time.
- Due list: "erledigt" also shows when a category chip hides everything or all `geraete` ids are unknown.
- Logout's 4 s timeout for disabling push is never cleared.
- Subscriptions answered with anything but 404/410 (e.g. 401/403 after a VAPID key rotation, or junk
  keys) are kept and retried every minute all day, so rotating the VAPID keys needs everyone to
  subscribe again. A later fix: delete on 401/403 or after N failures.
- There is no cap on subscriptions per user, so a hostile member could add many endpoints that never
  answer and slow the sequential sends (15 s timeout each) for everyone. Fix like the SSRF line: host
  check, a cap of about 10 per user, or parallel sends.

Known dependency findings, checked 2026-10-31 (`govulncheck`, `npm audit`):

- `golang.org/x/crypto/openpgp` (GO-2026-5932): no fix exists, the package is unused here.
- `react-router` 6.30.6 is the newest 6.x and Ionic 9 requires `<7`. GHSA-wrjc-x8rr-h8h6 needs an
  attacker-controlled path in `<Link>` or `useNavigate`, but all paths come from `routes.ts` and record
  ids. GHSA-337j-9hxr-rhxg needs server-side rendering, which the app does not use. Do not run
  `npm audit fix --force`: it moves to react-router 8. Recheck when Ionic allows react-router 7.
- Low and moderate findings in build tooling that does not ship to the browser: `deepmerge`
  (GHSA-gcqx-w48m-w2h4), `glob` (GHSA-3g3m-2fjr-6pw4) and `minimatch` (GHSA-g3hv-75wg-m249), via
  `vite-plugin-pwa`/`workbox-build` and via `ts-morph` under `@ionic/react`'s
  `@stencil/react-output-target`. `glob` and `minimatch` were new on 2026-10-31.

## Environment notes

- Passkeys in a browser test: Chromium's `WebAuthn.addVirtualAuthenticator` over the DevTools protocol
  with `defaultBackupEligibility` and `defaultBackupState` behaves like a synced passkey.
- Toolchain on the dev machine: Go 1.27, Node 26, Docker, `govulncheck`, `actionlint`. `make test` runs
  the tests, not the security scans: run `govulncheck ./...` in `backend/` and `npm audit` in `web/`
  by hand, and `actionlint` after changing a workflow.
- Rate limits also apply in development, so repeated test logins from one machine can hit them. Browser
  test scripts that log in often should use a fresh data dir and stay under 5 password checks a minute.
- Push in a browser test: headless Chromium (old or new) has no push service ("push service not
  available") and reports `Notification.permission` as denied; headed Playwright Chromium with a
  persistent context (not incognito) subscribes at FCM and shows real pushes.
- Screenshots for UI checks: Playwright's Chromium at
  `~/.cache/ms-playwright/chromium-1140/chrome-linux/chrome` with **`--headless=old`** (the new
  headless mode enforces a minimum width of 500 px), `--window-size=390,844`,
  `--virtual-time-budget=4000`, against the Go server serving a fresh `make build`. Log in with the
  `make seed` users; seed a scratch dir with `go run ./cmd/seed <dir>` and serve it with `--dir <dir>`.
