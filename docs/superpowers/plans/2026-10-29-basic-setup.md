# Basic Setup (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running skeleton of the intern app (Go + PocketBase binary serving an embedded Ionic React
app with a clickable UI sketch of every screen), buildable as a Docker image, so the folder structure
and screens can be revised before any domain logic is written.

**Architecture:** One Go module at the repo root. `main.go` starts PocketBase and serves the built
frontend from `web/dist` (embedded via `web/embed.go`) with SPA fallback. The Ionic React app in
`web/` contains all screens from spec section 8 as static sketches with mock data and a sketch-only
"view as" switcher for permission levels. No collections, auth, push or due date logic yet.

**Tech Stack:** Go 1.27, PocketBase v0.41.x (as library), Node 26 / npm, Vite, React, Ionic React 8
with `@ionic/react-router` (react-router v5), `vite-plugin-pwa`, Vitest + Testing Library, Docker
(distroless), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-29-intern-platform-design.md` (sections 2, 8, 10 apply to
this phase; the rest is phase 2+).

## Execution record

**Status: done**, merged in PR #1 (merge commit `7204f2d`, 2026-10-29). Executed inline; the final
whole-branch review found no Critical/Important issues. The task text below is the original plan;
these deviations apply and the code is authoritative:

- **Layout (user decision mid-run):** Go module moved to `backend/` (`github.com/ffneumarkt/intern/backend`,
  `cmd/intern/main.go`, `internal/server/frontend.go` with exported `RegisterFrontend`,
  `ui/embed.go` exporting `Dist()`); Vite builds into `../backend/ui/dist`. Paths like `main.go`,
  `server.go`, `web/embed.go`, `web/dist` below refer to the old layout.
- **Logging (user request):** `internal/logging` with charmbracelet/log; `LOG_LEVEL` env.
- PocketBase v0.40.6 (newest tag; v0.41.x does not exist yet).
- react-router 6 instead of 5 (required by `@ionic/react-router` 9).
- Tests find Ionic elements by visible text via `web/src/test/ionic.ts` and drive inputs with
  `fireEvent`: jsdom does not model Ionic's shadow DOM roles and focus. `document.elementFromPoint` is
  stubbed in `src/test/setup.ts`.
- "Code manuell eingeben" and "Erfasst von" are native inputs; retired items use a show/hide button
  instead of `IonToggle` (does not fire in jsdom).
- Sketch level can also be set by URL: `?ansicht=public|use|check|manage`.
- Scaffold's oxlint removed. Final image `distroless/static` (root) instead of `:nonroot`.
- `packages: write` only on the `image` job (review finding).
- Added after the review on user request: item detail preselects the item in record use
  (`paths.recordUseFor(id)`), live code suggestions (`searchItems` in `sketch/mockData.ts`), and the
  GHCR source label in the Dockerfile.

Deferred minors are listed in `docs/superpowers/STATUS.md`.

## Global Constraints

- Repo layout exactly as spec section 2: `main.go`, `internal/`, `migrations/`, `web/`, `Dockerfile`,
  `compose.yaml`, `deploy/`, `.github/workflows/`.
- Internal packages present as empty packages with a doc comment: `internal/due`, `internal/notify`,
  `internal/push`, `internal/passkey`, `internal/snapshot`.
- Binary listens on port `8090`; in the container on `0.0.0.0:8090`; data dir `/pb_data`.
- `CGO_ENABLED=0`; final image `gcr.io/distroless/static`.
- Image `ghcr.io/ffneumarkt/intern`, tags `latest` and the commit SHA, pushed only from `main`.
- PocketBase routes `/api/*` and the admin UI `/_/` must keep working; the frontend is served at `/`.
- UI text is German (the public site and users are German-speaking); code, comments and identifiers
  are English.
- Sketch-only code lives in `web/src/sketch/` so phase 2 can delete it in one go.

## Review Focus

1. Reloading a deep link like `/material/items/abc` must return the app, not a 404 (SPA fallback).
2. Unknown `/api/...` paths must return PocketBase's JSON 404, not `index.html`.
3. The PocketBase admin UI at `/_/` must stay reachable with the frontend mounted at `/`.
4. `go build` and `go test` must work in a fresh clone without building the frontend first
   (`web/dist` placeholder), otherwise CI's Go job and IDEs break.
5. The service worker must not answer navigations to `/api/` or `/_/` with the cached app shell.

---

### Task 1: Go module, PocketBase skeleton and embedded frontend

**Files:**
- Create: `go.mod`, `main.go`, `server.go`, `server_test.go`
- Create: `web/embed.go`, `web/dist/.gitkeep`
- Create: `internal/due/doc.go`, `internal/notify/doc.go`, `internal/push/doc.go`,
  `internal/passkey/doc.go`, `internal/snapshot/doc.go`, `migrations/doc.go`
- Create: `.gitignore`, `README.md`

**Interfaces:**
- Produces: `package web` with `func Dist() fs.FS` (returns the `dist` sub-filesystem of
  `//go:embed all:dist`).
- Produces: `func registerFrontend(se *core.ServeEvent, fsys fs.FS)` in `server.go`, which registers
  `GET /{path...}` with `apis.Static(fsys, true)`.
- Produces: `main.go` creates `pocketbase.New()`, registers `migratecmd` (automigrate off),
  binds `app.OnServe()` to call `registerFrontend(se, web.Dist())`, then `app.Start()`.

- [ ] **Step 1: Init the module and add PocketBase**

Run: `go mod init github.com/ffneumarkt/intern && go get github.com/pocketbase/pocketbase@latest`
Expected: `go.mod` lists `github.com/pocketbase/pocketbase v0.41.x` or newer.

- [ ] **Step 2: Write the failing tests in `server_test.go`**

Use `tests.ApiScenario` from `github.com/pocketbase/pocketbase/tests` with a `TestAppFactory` that
binds `OnServe` to `registerFrontend(se, fsys)`, where `fsys` is an `fstest.MapFS` containing
`index.html` (`<p>app shell</p>`) and `assets/app.js`.

| Test | Request | Expected |
|---|---|---|
| `TestFrontendIndex` | `GET /` | 200, body contains `app shell` |
| `TestFrontendAsset` | `GET /assets/app.js` | 200, body is the file content |
| `TestFrontendDeepLinkFallback` | `GET /material/items/abc` | 200, body contains `app shell` |
| `TestAPINotShadowed` | `GET /api/does-not-exist` | 404, body does not contain `app shell` |
| `TestHealthStillWorks` | `GET /api/health` | 200 |

- [ ] **Step 3: Run the tests to verify they fail**

Run: `go test ./...`
Expected: FAIL, `registerFrontend` undefined.

- [ ] **Step 4: Implement `server.go`, `web/embed.go`, `main.go` and the package stubs**

Each `doc.go` holds only `package <name>` and a one-paragraph comment with that unit's
responsibility, copied from the spec's "Unit responsibilities" table. `web/dist/index.html` is a
`web/dist/.gitkeep` keeps the embed valid before the first frontend build; `.gitignore` ignores
`web/dist/*` except `.gitkeep`, plus `pb_data/`, `web/node_modules/`, `/intern`.

If `TestAPINotShadowed` fails because the catch-all route wins over PocketBase's API 404, register the
static route so it skips paths starting with `/api/` and `/_/` (call `e.Next()` for them).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `go vet ./... && go test ./...`
Expected: PASS.

- [ ] **Step 6: Manual check**

Run: `go run . serve`; `http://127.0.0.1:8090/` returns 404 (no frontend built yet) and
`http://127.0.0.1:8090/_/` shows the PocketBase setup screen. Stop the server, delete `pb_data/`.

- [ ] **Step 7: Commit**

```bash
git add go.mod go.sum main.go server.go server_test.go web/embed.go web/dist/.gitkeep internal migrations .gitignore README.md
git commit -m "add go module with pocketbase and embedded frontend"
```

`README.md` documents `go run . serve`, `npm --prefix web run dev` and
`make image`.

---

### Task 2: Ionic React app shell with routing and tabs

**Files:**
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`
- Create: `web/src/main.tsx`, `web/src/App.tsx`, `web/src/routes.ts`, `web/src/theme/variables.css`
- Create: `web/src/sketch/session.tsx`, `web/src/sketch/ViewAsBar.tsx`
- Create: `web/src/test/setup.ts`, `web/src/App.test.tsx`
- Create: `web/public/icons/` (reuse the site's logo-based PWA icons from `ffneumarkt-web/public/icons/`
  as placeholders)

**Interfaces:**
- Produces: `routes.ts` exports `paths` with exactly these entries (used by all screens and tests):

```ts
export const paths = {
  start: '/',
  login: '/login',
  transportDocument: '/befoerderungspapier',
  dueList: '/material',
  category: (id = ':categoryId') => `/material/kategorien/${id}`,
  item: (id = ':itemId') => `/material/geraete/${id}`,
  recordUse: '/material/verwendung',
  recordCheck: (id = ':itemId') => `/material/geraete/${id}/pruefung`,
  label: (id = ':itemId') => `/material/geraete/${id}/etikett`,
  manage: '/material/verwalten',
  settings: '/einstellungen',
};
```

- Produces: `sketch/session.tsx` exports
  `type SketchLevel = 'public' | 'use' | 'check' | 'manage'`,
  `SketchSessionProvider`, `useSketchSession(): { level: SketchLevel; setLevel(l: SketchLevel): void }`
  and `atLeast(level: SketchLevel, required: Exclude<SketchLevel, 'public'>): boolean`.
  The level persists in `localStorage` key `sketch.level` (wrapped in try/catch), default `public`.
- Produces: `ViewAsBar` — a small segment control "Ansicht als: Öffentlich / Verwendung / Prüfung /
  Verwaltung" shown at the top of every page.

- [ ] **Step 1: Scaffold the app**

Run: `npm create vite@latest web -- --template react-ts` (into the existing `web/` dir, keeping
`embed.go` and `dist/.gitkeep`), then in `web/`:
`npm i @ionic/react @ionic/react-router react-router@5 react-router-dom@5 ionicons` and
`npm i -D @types/react-router-dom@5 vitest jsdom @testing-library/react @testing-library/jest-dom vite-plugin-pwa`.
Scripts: `dev`, `build` (`tsc -b && vite build`), `test` (`vitest run`), `typecheck` (`tsc --noEmit`).

- [ ] **Step 2: Configure Vite**

`vite.config.ts`: `build.outDir = 'dist'`, `build.emptyOutDir = true`, plus a tiny inline plugin
whose `closeBundle` hook writes an empty `dist/.gitkeep` again (the Go embed needs it, and git must
not show it as deleted after a build); dev `server.proxy` for `/api` and `/_` to `http://127.0.0.1:8090`;
`test.environment = 'jsdom'`, `test.setupFiles = 'src/test/setup.ts'`.
`VitePWA({ registerType: 'autoUpdate', manifest: { name: 'FF Intern', short_name: 'FF Intern',
lang: 'de', start_url: '/', display: 'standalone', icons: [...] }, workbox: {
navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/api\//, /^\/_\//] } })`.

- [ ] **Step 3: Write the failing tests in `App.test.tsx`**

`setup.ts` imports `@testing-library/jest-dom/vitest`, calls `setupIonicReact({ mode: 'md' })` and
stubs `window.matchMedia`. Render `<App />` inside a `MemoryRouter`-compatible setup (the App accepts
an optional `initialPath` prop for tests, using `IonReactMemoryRouter` when given).

| Test | Setup | Expected |
|---|---|---|
| `shows public tabs only` | level `public`, path `/` | tabs "Start" and "Beförderungspapier" visible; "Material" and "Einstellungen" absent |
| `shows material tabs for use level` | level `use`, path `/` | tabs "Start", "Beförderungspapier", "Material", "Einstellungen" visible |
| `redirects material to login when public` | level `public`, path `/material` | heading "Anmelden" |
| `view as switcher changes level` | click "Verwaltung" in `ViewAsBar` | `localStorage['sketch.level'] === 'manage'` and "Material" tab visible |

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm --prefix web test`
Expected: FAIL, `App` has no tabs yet.

- [ ] **Step 5: Implement `App.tsx`**

`IonApp` → `SketchSessionProvider` → router → `IonTabs` with `IonRouterOutlet` and an `IonTabBar`.
Tabs: Start (`home`), Beförderungspapier (`document`), Material (`construct`, level ≥ `use`),
Einstellungen (`settings`, level ≥ `use`). Material routes guarded: level `public` redirects to
`paths.login`. Pages from Task 3 are imported from `web/src/pages/`; in this task each route renders a
temporary `<IonPage>` with its German title so the tests pass.

- [ ] **Step 6: Run tests, typecheck and build**

Run: `npm --prefix web test && npm --prefix web run typecheck && npm --prefix web run build`
Expected: tests PASS, no type errors, `web/dist/index.html` and `web/dist/sw.js` exist.

- [ ] **Step 7: Manual check through Go**

Run: `go run . serve`, open `http://127.0.0.1:8090/material/geraete/x`, reload: app loads (Review
Focus 1). Open `/_/`: admin UI loads (Review Focus 3).

- [ ] **Step 8: Commit**

```bash
git add web
git commit -m "add ionic react app shell with tabs and sketch session"
```

---

### Task 3: UI sketch of all screens

**Files:**
- Create: `web/src/sketch/mockData.ts`
- Create: `web/src/pages/StartPage.tsx`, `LoginPage.tsx`, `TransportDocumentPage.tsx`,
  `DueListPage.tsx`, `CategoryPage.tsx`, `ItemPage.tsx`, `RecordUsePage.tsx`, `RecordCheckPage.tsx`,
  `LabelPage.tsx`, `ManagePage.tsx`, `SettingsPage.tsx`
- Create: `web/src/components/DueStateBadge.tsx`
- Create: `web/src/pages/pages.test.tsx`
- Modify: `web/src/App.tsx` (replace temporary pages with the real page components)

**Interfaces:**
- Consumes: `paths`, `useSketchSession`, `atLeast` from Task 2.
- Produces: `type DueState = 'overdue' | 'dueToday' | 'dueSoon' | 'ok'` and
  `DueStateBadge({ state }: { state: DueState })` with labels "Überfällig" (danger), "Heute fällig"
  (warning), "Bald fällig" (warning, outline), "OK" (success). Phase 2 keeps this component.
- Produces: `mockData.ts` exports `categories` (2: "Atemschutzmasken" with max service life 15 years,
  "Lungenautomaten"), `checkTypes` (mask: "Maskenprüfung" 12 months + after use, "5-Jahres-Prüfung"
  60 months, also satisfies "Maskenprüfung"), `items` (6, covering all four due states and one
  `defective`, one `retired`), `history` (checks and uses for one item). Shapes mirror the spec's
  collection fields so phase 2 can swap in API data.

Screen content (sketch level: real Ionic components, mock data, buttons that navigate but do not
save):

| Page | Content |
|---|---|
| Start | Tool tiles "Beförderungspapier" and "Material" (Material only at level ≥ `use`), "Anmelden" button at `public` |
| Login | "Mit Passkey anmelden" button, divider, email + password fields, "Anmelden" |
| Beförderungspapier | Placeholder card "Generator wird aus ffneumarkt-web übernommen" (ported in a later phase) |
| Due list | Category filter chips, list grouped "Überfällig / Heute fällig / Bald fällig" with `DueStateBadge`, FAB "Verwendung erfassen" |
| Category | Item list with badges, toggle "Ausgeschiedene anzeigen" |
| Item | Header (name, serial, barcode, status), due date per check type, end of life, combined history; buttons "Verwendung erfassen" (≥ `use`), "Prüfung erfassen" and "Ausscheiden" (≥ `check`), "Bearbeiten" and "Etikett drucken" (≥ `manage`) |
| Record use | Step 1: scanner area placeholder (camera box, camera picker, torch toggle, "Code manuell eingeben"), scanned list with remove; "Weiteres Gerät scannen?" Ja/Fertig. Step 2: form date, kind (Einsatz/Übung/Sonstiges), "Erfasst von", note, "Speichern" |
| Record check | Check type select, date, result (Bestanden/Mangel/Ausgeschieden), note |
| Label | Print preview of one QR label (placeholder square + item name), "Drucken" |
| Manage | Segments "Geräte" / "Prüfarten"; lists with "+" buttons; item form incl. "Zuletzt geprüft am" per check type |
| Settings | Per category: timings chips (14, 3, 0 Tage) and toggle "Wöchentlich bei Überfälligkeit"; "Push auf diesem Gerät aktivieren" with iOS hint card; passkey list with "Passkey hinzufügen"; "Abmelden" |

- [ ] **Step 1: Write the failing tests in `pages.test.tsx`**

| Test | Setup | Expected |
|---|---|---|
| `due list groups items by state` | level `use`, path `paths.dueList` | headings "Überfällig", "Heute fällig", "Bald fällig" each followed by the mock items in that state |
| `item actions follow level: use` | level `use`, `paths.item(<mock id>)` | "Verwendung erfassen" visible; "Prüfung erfassen", "Bearbeiten" absent |
| `item actions follow level: check` | level `check` | "Prüfung erfassen" and "Ausscheiden" visible; "Bearbeiten" absent |
| `item actions follow level: manage` | level `manage` | "Bearbeiten" and "Etikett drucken" visible |
| `record use scan loop` | level `use`, `paths.recordUse`, enter a mock barcode in "Code manuell eingeben" twice (same code), then a second code, click "Fertig" | scanned list has 2 entries (duplicate ignored), form with "Erfasst von" shown |
| `unknown code` | enter `UNKNOWN-1` | text "Nicht gefunden"; "Gerät zuordnen" only at level `manage` |
| `category hides retired items` | `paths.category(<masks id>)` | retired mock item absent; after toggling "Ausgeschiedene anzeigen" present |

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix web test`
Expected: FAIL, pages not implemented.

- [ ] **Step 3: Implement `DueStateBadge`, `mockData.ts` and the pages, wire them into `App.tsx`**

The record use page keeps scanned items in component state; manual code entry stands in for the
camera in this phase. Mock barcode lookup is a plain `items.find(i => i.barcode === code)`.

- [ ] **Step 4: Run tests, typecheck and build**

Run: `npm --prefix web test && npm --prefix web run typecheck && npm --prefix web run build`
Expected: all PASS.

- [ ] **Step 5: Manual walkthrough**

Run `npm --prefix web run dev` (with `go run . serve` in parallel). Click through every screen at each
"Ansicht als" level on a desktop width and at 390 px (browser dev tools) and fix overflow or broken
layout.

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "add ui sketch of all screens with mock data"
```

---

### Task 4: Docker image, compose reference, Makefile and CI

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `compose.yaml`, `Makefile`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm --prefix web run build|test|typecheck` scripts (Task 2), `go test ./...` (Task 1).
- Produces: `make dev-api` (`go run . serve`), `make dev-web` (`npm --prefix web run dev`),
  `make test` (Go + web tests), `make image` (`docker build -t intern:local .`), `make run`
  (`docker run --rm -p 8090:8090 -v $(PWD)/pb_data:/pb_data intern:local`).

- [ ] **Step 1: Write the Dockerfile**

Stages: `node:26-alpine` (`npm ci` + `npm run build` in `/src/web`) → `golang:1.27-alpine`
(copy source and `web/dist`, `CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /intern .`) →
`gcr.io/distroless/static:nonroot` with `/intern`, `VOLUME /pb_data`, `EXPOSE 8090`,
`ENTRYPOINT ["/intern"]`, `CMD ["serve", "--http=0.0.0.0:8090", "--dir=/pb_data"]`.
`.dockerignore` excludes `.git`, `pb_data`, `web/node_modules`, `web/dist`.

- [ ] **Step 2: Build and smoke-test the image**

Run: `make image && docker run -d --name intern-smoke -p 8090:8090 intern:local && sleep 2 && curl -fsS http://127.0.0.1:8090/api/health && curl -fsS http://127.0.0.1:8090/material/geraete/x | grep -q '<div id="root"' ; docker rm -f intern-smoke`
Expected: health JSON with `"code":200`, grep succeeds. (With the `nonroot` image the anonymous volume
must be writable; if PocketBase fails to create `/pb_data`, add `USER nonroot` with a pre-created
directory owned by uid 65532 via a `COPY --chown` of an empty dir.)

- [ ] **Step 3: Write `compose.yaml`**

Services `intern` (`image: ghcr.io/ffneumarkt/intern:latest`, `restart: unless-stopped`,
`volumes: ["./data:/pb_data"]`, `env_file: .env`) and `cloudflared`
(`image: cloudflare/cloudflared:latest`, `command: tunnel --no-autoupdate run`,
`environment: TUNNEL_TOKEN=${TUNNEL_TOKEN}`, `restart: unless-stopped`, `depends_on: [intern]`).
No ports published. Validate with `docker compose config` (with a dummy `.env`).

- [ ] **Step 4: Write `.github/workflows/ci.yml`**

Trigger: `pull_request` and `push` to `main`. Jobs:
- `web`: setup-node 26 with npm cache, `npm ci`, `npm run typecheck`, `npm test` in `web/`.
- `go`: setup-go from `go.mod`, `go vet ./...`, `go test ./...` (works without a frontend build,
  Review Focus 4).
- `image` (needs both): `docker/setup-buildx-action`, `docker/login-action` to `ghcr.io` with
  `GITHUB_TOKEN` (only on push to `main`), `docker/build-push-action` with
  `push: ${{ github.event_name == 'push' }}`, tags `ghcr.io/ffneumarkt/intern:latest` and
  `ghcr.io/ffneumarkt/intern:${{ github.sha }}`, GHA cache. Permissions: `contents: read`,
  `packages: write`.

- [ ] **Step 5: Verify locally**

Run: `make test && docker compose config -q`
Expected: tests PASS, compose config valid. CI itself is verified on the first PR.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile .dockerignore compose.yaml Makefile .github README.md
git commit -m "add docker image, compose reference and ci"
```

---

## Not in this phase

Collections and migrations, collection rules, auth (password and passkeys), due date logic,
notifications and push, camera scanning, the real Beförderungspapier port, `deploy/` (systemd timer,
backup wrapper), `intern snapshot`. These follow in later plans after the structure and UI sketch have
been revised.
