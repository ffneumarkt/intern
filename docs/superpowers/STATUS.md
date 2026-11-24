# Project status and handover

Last updated: 2026-11-05. Read this first, then the spec
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
- **End-to-end suite** (Playwright in `web/e2e/`, `make e2e`, CI `e2e.yml` on PRs touching `web/` or
  `backend/`): drives the built binary with a seeded temp data dir in Chromium, Firefox and WebKit
  (CI runs one job per browser in parallel: about 3 min instead of 7).
  WebKit on Linux is not a real iPhone, it only catches engine differences. Passkey tests run in
  Chromium only (virtual authenticator); push delivery is not testable. Locally on Arch, WebKit does not
  run natively (it needs the Playwright Docker image), so use
  `npm --prefix web run e2e -- --project=chromium --project=firefox`; CI runs all three.
- **Einstellungen rework done** (plan `plans/2026-10-31-e2e-and-settings-ui.md`): Ionic switches in
  inset groups (Dieses Gerät, Erinnerungen, Ruhezeit, Passkeys), every change saves right away (no
  Ruhezeit save button), one save at a time with a busy guard, a failed save flips the switch back,
  messages carry `role="status"`/`"alert"`, and the day chips are toggle buttons (`role="button"`,
  `aria-pressed`, Enter and Space). A user without a permitted category sees a hint under
  „Erinnerungen“. A browser without a working push service (Playwright's Firefox) now shows push as off
  instead of „Keine Verbindung“ for the whole section. jsdom tests in `pages.test.tsx`, real-browser
  tests in `web/e2e/settings.spec.ts`.
- **Ionic migration done** (plan `plans/2026-10-31-ionic-dialogs-and-forms.md`): confirm and prompt
  dialogs are `IonAlert`s (`components/useDialogs.ts`), and `components/Field.tsx` renders `IonInput`,
  `IonTextarea`, `IonSelect` (popover interface: one tap) and `IonToggle` for every form (login,
  record use incl. the manual code field, record check, item form, check type form, passkey add).
  Native on purpose: the Ruhezeit `Von`/`Bis` time inputs, and the date fields, which are `IonInput
  type="date"` and so open the OS date picker (`IonDatetime` is not used). E2E: `dialogs.spec.ts`,
  `forms.spec.ts` (Enter submits the login, a use, a check and a new item are saved and show in the
  history; throwaway items are removed with their history through the e2e superuser); screenshots of
  every form in iOS and Material mode were checked.
- **Phase 6 done** (branch `feature/transport-document`, PR pending, no separate plan: the spec's §8 was
  the design): the Beförderungspapier page on `web/src/transportDocument/` (`calc.ts`, `fillForm.ts`,
  `formLayout.ts` and their tests copied from ffneumarkt-web; the fillForm test wraps the PDF bytes in a
  `Uint8Array` because jsdom rejects a Node `Buffer`). Built for minimal taps: the count field is
  prefilled with the last count that produced a PDF (`localStorage`), the route is the standard trip
  (Station → Füllstelle and back) and "PDF öffnen" opens the PDF in a new tab (download if blocked).
  Everything else (sender, recipient, other addresses, return count) sits under the collapsed
  „Abweichende Route“ and is not remembered. Settings come from `api/transport.ts`
  (`transport_document_settings`, public); migration `1793380007` seeds the default record (FF Neumarkt,
  FF Grünbach, 6,8 l, 1000 points, the five checklist items) when none exists. Offline: the service worker
  precaches the PDF template (pdf-lib is a JS chunk) and caches the settings request network first; the
  last loaded settings are also kept in `localStorage` (WebKit takes control of a page later, so the
  worker's cache alone was empty on a first visit followed by going offline). Tests:
  `pages/TransportDocumentPage.test.tsx`, `api/transport.test.ts`, `transportDocument/lastCount.test.ts`,
  `web/e2e/transport.spec.ts` (PDF made, offline reload; run in Chromium and Firefox locally, WebKit only
  in CI). Not observed: an installed iOS PWA opening the blob PDF in a new tab (check after deploy).
  The page is styled in the identity of ffneumarkt.at (`ffneumarkt-web/src/styles/theme.css`): the whole
  app now uses RAL 3000 `#AF2B1E` as primary colour (also the manifest `theme_color`), the site's slate
  text and `#f1f5f9` page, and Roboto (`@fontsource/roboto`, latin 400/500/700, precached). The page has a
  route drawn as two stops, a stepper with a points gauge (green, amber above 80 %, red above the limit),
  a sticky „PDF öffnen“ bar and a check-marked checklist; `transportDocument/transportDocument.css`
  holds it. The other pages follow the same look through `web/src/theme/ui.css`: `Page` puts every page on
  the grey `#f1f5f9` background in a centred 560 px column, lists and cards are white rounded surfaces,
  due states are tinted pills (`DueStateBadge`) with a coloured row edge, fields are bordered boxes under
  a stacked label (drawn in CSS: Ionic's `fill="outline"` is not drawn in list items and would hide the
  textarea label from tests), primary actions sit in a sticky `.ui-actions` bar, and error text is a
  tinted box. The start page has tiles, login has the logo. A floating button must be passed to `Page`
  as `fab`, since `slot="fixed"` only works as a direct child of the content.
- **Legal pages** (branch `feature/legal-pages`): `/info` (hub), `/info/impressum` and `/info/datenschutz`, public
  and part of the offline shell. Anonymous users get an „Info“ tab (logged-in users do not); logged-in users
  find the same two rows under „Rechtliches“ in Einstellungen (`components/LegalItems.tsx`). Structure and
  wording follow the Impressum and Datenschutz pages of ffneumarkt-web; the contact data is static in
  `web/src/legal/contact.ts`. The Datenschutzerklärung is rewritten for what this app stores (accounts,
  uses and checks with names, passkeys, push subscriptions, `localStorage`, PocketBase request logs for 5
  days incl. IP, Cloudflare). **Not legal advice: the owner must read it** and in particular confirm the
  hosting wording („gemieteter Server (VPS)“), the legal bases and the retention statements.
- **Phase 5 done** (PR #22; spec `specs/2026-11-24-barcode-scanning-design.md`,
  plan `plans/2026-11-24-barcode-scanning.md`): codes are manufacturer codes only, so the QR label page is
  gone and nothing is printed. `components/Scanner.tsx` (over `scan/useCamera.ts` and `scan/detector.ts`,
  `barcode-detector` with a self-hosted, precached wasm in its own lazy chunk) is used in „Verwendung
  erfassen“ (there is no scan button on the due list any more; its floating button opens that page). A `manage` user assigns an
  unknown code to an item with `AssignCode` (`assignBarcode`). Tests use `test/fakeScanner.tsx` and
  `test/fakeCamera.ts`; `web/e2e/scan.spec.ts` decodes a real QR from a fake camera feed in Chromium only
  (`e2e/fixtures/qr.y4m`); Firefox and WebKit check manual entry. Not observed: real iPhone and Android
  cameras, the torch on hardware, the Surface webcam, scan speed on worn manufacturer codes, an installed
  PWA scanning offline.
- **Mask measurements done** (branch `feature/mask-measurements`; spec `specs/2026-11-24-mask-measurements-design.md`,
  plan `plans/2026-11-24-mask-measurements.md`): the paper „AS-Masken Betriebsnachweis“ columns as values. A check
  type has a switch „Messwerte erfassen“ (`check_types.measurements`, on for the seeded Maskenprüfung); recording
  such a check shows the Dichtprüfung (start pressure −10 prefilled, a 60 s countdown from a start timestamp with
  wake lock and vibration where supported, the pressure after 60 s, the loss with its 1 mbar limit) and the
  Öffnungsdruck (4,2–6,0 mbar). The readings suggest Bestanden or Mangel until the user picks one, and all three
  are required (client side). Stored on `checks` as `leak_start_mbar`, `leak_end_mbar`, `opening_pressure_mbar`
  (PocketBase stores an empty number as 0, so a check with all three at 0 has no readings); the history shows
  them. Logic in `material/measurements.ts`, `material/useCountdown.ts`, `components/Measurements.tsx`; e2e in
  `web/e2e/measurements.spec.ts`. Run in Chromium locally; Firefox and WebKit run in CI. Not observed: the
  countdown to zero in a real browser (the e2e only starts it), wake lock and vibration on a real phone, the
  negative sign on iOS keyboards (the fields use the normal keyboard because the number pad has no minus).
- **Check from the due list:** a „Prüfen“ button on every due row (for users who may check that category) opens the
  check form of the item directly (`/material/geraete/<id>/pruefung?von=liste`); back and saving return to the list,
  with its filter. The rest of the row still opens the item page. The measurement fields only show for check types
  with „Messwerte erfassen“ switched on in Verwalten; a database that was not created by `make seed` has it off
  everywhere.
- **Locations done** (branch `feature/locations`, PR pending; spec `specs/2026-11-25-locations-design.md`, plan
  `plans/2026-11-25-locations.md`): every item has a current location from a managed list (`locations`: AS-Werkstatt
  is the default and created by the migration; trucks such as RLF and LAST are added in Verwalten → Standorte).
  The server keeps it: a use moves the item to the default location, a check with a location moves it there, a
  check without one records where the item is; the location is also stored on every use and check for the history
  („Standort: RLF“). „Prüfung erfassen“ offers a „Standort“ select (workshop preselected) when the result is
  Bestanden. The category page has location chips that show only the items currently there (not the due list); rows
  and the item page show the location; the item form has a location select. A location in use and the default one
  cannot be deleted; `is_default` cannot be set through the API. Rules: any logged in user reads, the manage level
  in any category manages. Not built: a location history page, locations per category, stock counts.
- Dependabot (`.github/dependabot.yml`) opens a weekly PR (Mondays) per ecosystem: Go modules, npm, GitHub
  Actions and the Docker base images; minor and patch updates are grouped, a major update comes alone.
  The normal CI runs on those PRs; the user merges. Major updates of `react-router` and `react-router-dom` are
  ignored: `@ionic/react-router` 9.0.13 allows only versions below 7 and breaks with 7 (checked: 179 of 338
  tests fail inside `IonRouter`). Lift the rule when Ionic releases support for 7 or later.
- **Deploy files done** (PR #24, no separate plan: spec §10 was the design):
  `intern snapshot` (`internal/snapshot`, `VACUUM INTO` in a temporary directory, gzip to stdout, tests
  restore the copy) and `deploy/` (systemd update timer, `intern-backup` wrapper with its sudoers line and
  `authorized_keys` example, `.env` example, `restore-test.sh`, runbook `deploy/README.md`). The restore
  test was run against a snapshot of the seed data and the published image. Not done: the VPS itself
  (Docker, tunnel, hostname, users), the NAS job, the post-deploy checks on real devices.
- Nothing is deployed to the VPS yet.

## How the process works here

The user works with the superpowers skills: brainstorming → spec → writing-plans → execution, with
each phase getting its own plan in `docs/superpowers/plans/`. Commits end with a `Co-Authored-By`
line; work happens on branches with PRs against `main` (the user merges).

## Next steps (proposed order, each needs its own plan)

1. **Deploy** (files done, see above): VPS setup with its own `cloudflared` and hostname
   `intern.ffneumarkt.at`, restore test. After the first deploy, check what can't be tested locally:
   passkeys on a real iPhone, Android phone and Windows device, including Safari with the two-tap
   confirmation, push on the same devices (iOS only from the home screen), and that rate limits count
   per client with real `CF-Connecting-IP` traffic, and that the Beförderungspapier PDF opens from the
   installed PWA on iOS and Android and works in airplane mode. Everyone at the station shares one IP and so one
   budget. The container must keep publishing no port, or that header can be spoofed. Generate the VAPID
   keys with `docker run --rm ghcr.io/ffneumarkt/intern vapid`; `VAPID_SUBJECT` (a `mailto:` address or
   https URL) is set by hand.
2. **ffneumarkt-web follow-ups** (spec §12): revert #10 there now (production has no iOS icon), redirect
   and cleanup at go-live.
3. **E2E follow-ups:** `image.yml` may gate on `e2e.yml` once it has run stably.

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

From the Ionic forms check (screenshots at 390 px, iOS and Material):

- In an alert the destructive button has the same red as the primary colour, so on iOS only its bold
  weight sets „Löschen“ apart from „Abbrechen“.
- The manual code field in Verwendung erfassen sits in an `IonItem` inside a card, so it is indented
  twice and the suggestion box under it starts a little left of the field. Readable, not aligned.
- Form fields (inside `IonItem`s) start 16 px further in than the text and buttons of the page.
- The date fields show `mm/dd/yyyy` in Playwright's browsers despite `de-AT`: the native control
  follows the browser's own locale (as with the Ruhezeit times).
- On the manage page the item list starts right under the segment, with no gap.
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
- Screenshots of Einstellungen and the forms: `E2E_SCREENSHOTS=1 npm --prefix web run e2e --
  e2e/screens.spec.ts` writes `web/test-results/screens/<project>-<state>.png` (WebKit = iOS look,
  Chromium and Firefox = Material; `E2E_SCREENS_DIR` picks another folder). They are not committed, and
  the next Playwright run clears `test-results/`. Without WebKit, iOS mode also shows in Chromium with
  the `devices['iPhone 14']` profile (its iOS user agent makes Ionic pick iOS mode), e.g. from a local
  config that adds such a project. The native
  time inputs show AM/PM in Playwright's Chromium and Firefox despite `locale: 'de-AT'` (the browser's
  own locale decides); a German browser shows 24 h.
- `page.route` in WebKit does not see requests of a page that the PWA service worker controls; block
  service workers in such a test (`serviceWorkers: 'block'`, see `settings.spec.ts`).
- Screenshots for UI checks: Playwright's Chromium at
  `~/.cache/ms-playwright/chromium-1140/chrome-linux/chrome` with **`--headless=old`** (the new
  headless mode enforces a minimum width of 500 px), `--window-size=390,844`,
  `--virtual-time-budget=4000`, against the Go server serving a fresh `make build`. Log in with the
  `make seed` users; seed a scratch dir with `go run ./cmd/seed <dir>` and serve it with `--dir <dir>`.
