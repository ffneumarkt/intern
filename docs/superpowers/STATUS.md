# Project status and handover

Last updated: 2026-10-30. Read this first, then the spec
(`specs/2026-10-29-intern-platform-design.md`), which is the binding design.

## Where things stand

- **Phase 1 done** (plan `plans/2026-10-29-basic-setup.md`, PR #1, merge `7204f2d`): Go + PocketBase
  skeleton serving the embedded frontend, German Ionic React UI sketch of all screens with mock data,
  Docker image, reference `compose.yaml`, Makefile, CI.
- CI on `main` pushes `ghcr.io/ffneumarkt/intern:latest` and `:<sha>`. The package is **public** and
  linked to the repo; anonymous pull verified.
- **Phase 2 done** (plan `plans/2026-10-30-data-and-auth.md`, branch `feature/data-and-auth`): all
  collections and rules, password login, `/api/material/due` with `internal/due`, status hooks, member
  deactivation, every screen on real data, `web/src/sketch/` deleted, `make seed` for sample data.
- Nothing is deployed to the VPS yet. No `deploy/` files exist yet.

## How the process works here

The user works with the superpowers skills: brainstorming → spec → writing-plans → execution, with
each phase getting its own plan in `docs/superpowers/plans/`. Commits end with a `Co-Authored-By`
line; work happens on branches with PRs against `main` (the user merges).

## Next steps (proposed order, each needs its own plan)

1. **Phase 3: passkeys** (spec §5, `internal/passkey`). Login must reject `users.deactivated`; bring
   back the login button and the Settings section removed in phase 2.
2. **Phase 4: notifications and push** (spec §7, `internal/notify`, `internal/push`, VAPID). Skip
   deactivated users; bring back the Settings sections removed in phase 2.
3. **Phase 5: camera scanning and QR labels** (spec §9, `barcode-detector`): camera picker and torch
   removed in phase 2, the label page's QR placeholder, assigning an unknown code to an item.
4. **Phase 6: Beförderungspapier port** from `ffneumarkt-web/src/components/features/transportDocument/`
   (`calc.ts`, `fillForm.ts` + tests unchanged), config from `transport_document_settings`, offline.
5. **Deploy:** `deploy/` (systemd update timer, backup wrapper, `authorized_keys` example),
   `intern snapshot` (spec §10), VPS setup with its own `cloudflared` and hostname
   `intern.ffneumarkt.at`, restore test.
6. **ffneumarkt-web follow-ups** (spec §12): revert #10 there now (production has no iOS icon), redirect
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

## Environment notes

- Toolchain on the dev machine: Go 1.27, Node 26, Docker. `make test` runs everything.
- Screenshots for UI checks: Playwright's Chromium at
  `~/.cache/ms-playwright/chromium-1140/chrome-linux/chrome` with **`--headless=old`** (the new
  headless mode enforces a minimum width of 500 px), `--window-size=390,844`,
  `--virtual-time-budget=4000`, against the Go server serving a fresh `make build`. Log in with the
  `make seed` users; seed a scratch dir with `go run ./cmd/seed <dir>` and serve it with `--dir <dir>`.
