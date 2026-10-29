# Project status and handover

Last updated: 2026-10-29. Read this first, then the spec
(`specs/2026-10-29-intern-platform-design.md`), which is the binding design.

## Where things stand

- **Phase 1 done** (plan `plans/2026-10-29-basic-setup.md`, PR #1, merge `7204f2d`): Go + PocketBase
  skeleton serving the embedded frontend, German Ionic React UI sketch of all screens with mock data,
  Docker image, reference `compose.yaml`, Makefile, CI.
- CI on `main` pushes `ghcr.io/ffneumarkt/intern:latest` and `:<sha>`. The package is **public** and
  linked to the repo; anonymous pull verified.
- Nothing is deployed to the VPS yet. No `deploy/` files exist yet.
- The user is **revising the UI sketch**; changes so far: record use preselects the item when opened
  from the detail page, live suggestions while typing a code.

## How the process works here

The user works with the superpowers skills: brainstorming → spec → writing-plans → execution, with
each phase getting its own plan in `docs/superpowers/plans/`. Commits end with a `Co-Authored-By`
line; work happens on branches with PRs against `main` (the user merges).

## Next steps (proposed order, each needs its own plan)

1. **Finish revising the sketch** with the user (screens, wording, flows) before real data.
2. **Phase 2: data and auth.** Migrations for all collections and rules (spec §3, §4), password login,
   replace `web/src/sketch/` with real data via the PocketBase JS SDK, `/api/material/due` +
   `internal/due` (spec §6), rule tests per level.
3. **Phase 3: passkeys** (spec §5, `internal/passkey`).
4. **Phase 4: notifications and push** (spec §7, `internal/notify`, `internal/push`, VAPID).
5. **Phase 5: camera scanning and QR labels** (spec §9, `barcode-detector`).
6. **Phase 6: Beförderungspapier port** from `ffneumarkt-web/src/components/features/transportDocument/`
   (`calc.ts`, `fillForm.ts` + tests unchanged), config from `transport_document_settings`, offline.
7. **Deploy:** `deploy/` (systemd update timer, backup wrapper, `authorized_keys` example),
   `intern snapshot` (spec §10), VPS setup with its own `cloudflared` and hostname
   `intern.ffneumarkt.at`, restore test.
8. **ffneumarkt-web follow-ups** (spec §12): revert #10 there now (production has no iOS icon), redirect
   and cleanup at go-live.

## Open questions

- Code suggestions: cap the list length? Keep matching on names or codes only?

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
  `--virtual-time-budget=4000`, against the Go server serving a fresh `make build`. Use
  `?ansicht=<level>` to pick the sketch level.
