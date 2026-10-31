# Real-browser tests and the Einstellungen rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-browser end-to-end tests (Chromium, Firefox, WebKit) and use them to rework the Einstellungen page with Ionic components, so the on/off state of every setting is clear at first look.

**Architecture:** Playwright Test runs against the real binary (built frontend embedded) with a seeded temporary data dir. The jsdom suite keeps pure logic and render checks, because Ionic form controls cannot be driven there: `onIonChange` is never attached under jsdom and props such as `type` and `value` do not reach `IonInput`. Two stacked PRs: A (Tasks 1-2: the suite and its CI job) on branch `test/e2e-playwright`, B (Tasks 3-4: the rework and its end-to-end tests) on branch `feature/settings-ionic-ui`, based on A.

**Tech Stack:** `@playwright/test`, Ionic React 9 (`IonToggle`, `IonList inset`, `IonListHeader`, `IonNote`, `IonItem`), Go 1.27 binary, GitHub Actions.

**Context (decided with the user):** native text inputs (`Field.tsx`) stay for the other forms, each form moves to `IonInput` later, together with its end-to-end coverage. This plan touches only Einstellungen. The reason native inputs were chosen was jsdom, not UX (see `plans/2026-10-30-data-and-auth.md` line 19).

## Global Constraints

- Everything in `CLAUDE.md`: TDD where jsdom can express the behaviour, UI text German only, code and comments English, charmbracelet/log in Go (no Go code changes are expected), conventions for Ionic in tests.
- Never redirect from a page or route element (`<Navigate>`); see `LoginRedirect` in `App.tsx`.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (the line the controller gives; use it as given).
- Seed users (`go run ./cmd/seed <dir>`): `keine@`, `verwendung@` (use), `pruefung@` (check), `verwaltung@` (manage), all `@ffneumarkt.local`, password `intern-dev-1234`; categories `Atemschutzmasken`, `Lungenautomaten`.
- Rate limits: 5 password checks per minute per IP and 5 test pushes per minute. The end-to-end server switches them off through the superuser settings API; the suite must not depend on them.
- CI workflows: one per concern, `concurrency` group named literally (`github.workflow` is the caller's name in a called workflow), `actionlint` clean, actions pinned as in the existing workflows.
- The Playwright version is pinned exactly and is at least 14 days old (`npm view @playwright/test time`).
- `make test` stays fast and browser-free. End-to-end tests run with `make e2e`.

## Review Focus

1. Toggling a setting whose save fails must flip the switch back and say so; a switch must never show a state the server doesn't have. (Task 3, Task 4)
2. Enabling push when the browser has not granted permission leaves the switch off and shows „Benachrichtigungen sind im Browser blockiert.“ (Task 3, Task 4, Chromium)
3. Quiet time: equal times are refused with the red message and nothing is saved; switching it off and on again restores the times. (Task 3, Task 4)
4. The suite must not leak state between tests or browsers: data changed by one test is restored, and a test never depends on the order. (Task 1, Task 4)
5. The page works in both Ionic modes: iOS (WebKit with an iPhone profile) and Material (Chromium, Firefox). (Task 4)

---

## File Structure

| File | Responsibility |
|---|---|
| `web/playwright.config.ts` | projects (chromium, firefox, webkit), phone viewport, web server, global setup |
| `web/e2e/server.mjs` | builds the binary (unless `E2E_SKIP_BUILD`), seeds a temp data dir, creates the superuser and VAPID keys, starts the server on port 8099, cleans up |
| `web/e2e/global-setup.ts` | superuser login, rate limits off, one storage state per seed user in `web/e2e/.auth/` |
| `web/e2e/fixtures.ts` | `test` with `signedInAs(user)` and API helpers to read and reset a user's notification data |
| `web/e2e/*.spec.ts` | specs |
| `.github/workflows/e2e.yml` | CI job |
| `web/src/components/notificationText.ts` | pure text and logic helpers for the settings (Task 3) |
| `web/src/components/NotificationSettings.tsx`, `web/src/pages/SettingsPage.tsx` | the reworked page (Task 3) |

---

### Task 1: Playwright foundation and the login specs

**Files:**
- Create: `web/playwright.config.ts`, `web/e2e/server.mjs`, `web/e2e/global-setup.ts`, `web/e2e/fixtures.ts`, `web/e2e/login.spec.ts`, `web/e2e/navigation.spec.ts`
- Modify: `web/package.json` (+ lock), `web/vite.config.ts` (vitest must not pick up `e2e/**`), tsconfig so `npm run typecheck` covers `playwright.config.ts` and `e2e/`, `Makefile` (`e2e` target, `.PHONY`), `.gitignore`, `CLAUDE.md` (commands)

**Interfaces:**
- Produces: `npm run e2e` (= `playwright test`); fixture `test` from `e2e/fixtures.ts`:

```ts
export type SeedUser = 'keine' | 'verwendung' | 'pruefung' | 'verwaltung'
export const test: TestType<...>  // Playwright's test, extended
// test.use({ storageState: authState('verwendung') }) signs a project's tests in
export const authState: (user: SeedUser) => string
export const password = 'intern-dev-1234'
export const email: (user: SeedUser) => string   // `${user}@ffneumarkt.local`
// Admin helpers over the REST API, for setup and cleanup (they use the user's own token):
export async function resetNotificationData(request: APIRequestContext, user: SeedUser): Promise<void>
```

- [ ] **Step 1: Install and configure.** Remove the `node_modules` symlink in the worktree and run `npm ci` in `web/` (the worktree needs its own install), then add `@playwright/test` as an exact-pinned devDependency (version rule in Global Constraints). Install the browsers with `npx playwright install chromium firefox webkit` (CI uses `--with-deps`). Add `"e2e": "playwright test"` to the scripts.
- [ ] **Step 2: `web/e2e/server.mjs`.** Resolve `../backend` relative to the file. Unless `E2E_SKIP_BUILD=1`: `npm run build` in `web/` (frontend into `backend/ui/dist`) and `CGO_ENABLED=0 go build` of `./cmd/intern` and `./cmd/seed` into `backend/.e2e/`. Create a temp data dir with `mkdtemp`, run the seed binary on it, run `intern superuser upsert e2e@example.com <password>`, generate VAPID keys with `intern vapid` (parse the two `KEY=value` lines; the compiled binary prints nothing else on success; fail loudly otherwise), then start `intern serve --dir <tmp> --http 127.0.0.1:8099` with `PASSKEY_RP_ID=localhost`, `PASSKEY_ORIGIN=http://localhost:8099`, the VAPID variables (`VAPID_SUBJECT=mailto:e2e@example.com`) and `LOG_LEVEL=warn`. Forward SIGINT/SIGTERM to the child and remove the temp dir when it exits. Print the superuser credentials only to the child environment, never to the log.
- [ ] **Step 3: `web/playwright.config.ts`.** `testDir: 'e2e'`, `workers: 1`, `fullyParallel: false`, `retries: process.env.CI ? 1 : 0`, reporters `list` plus `html` (not opened), `globalSetup`, `webServer: { command: 'node e2e/server.mjs', url: 'http://localhost:8099/api/health', reuseExistingServer: !process.env.CI, timeout: 240_000 }`, `use: { baseURL: 'http://localhost:8099', trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'de-AT', timezoneId: 'Europe/Vienna' }`. Projects `chromium` (Desktop Chrome), `firefox` (Desktop Firefox), `webkit` (iPhone 14 device profile, so Ionic runs in iOS mode); give chromium and firefox a phone-sized viewport (390x844) because the app is built for phones.
- [ ] **Step 4: `global-setup.ts`.** Log in as the superuser (credentials shared with `server.mjs` through environment variables that `server.mjs` documents and the config passes on) and `PATCH /api/settings` with `{ "rateLimits": { "enabled": false } }`. Then, for each seed user, authenticate through `POST /api/collections/users/auth-with-password` and write a Playwright storage state `web/e2e/.auth/<user>.json` with one localStorage entry `pocketbase_auth` (`{ token, record }`) for origin `http://localhost:8099`.
- [ ] **Step 5: `fixtures.ts`** as in Interfaces. `resetNotificationData` deletes the user's rows in `notification_settings`, `notification_preferences` and `push_subscriptions` through the REST API with the user's token (read the token from the storage state file).
- [ ] **Step 6: Write `login.spec.ts`** (it must fail first where the app could be wrong; run it and report). Specs, all with their own page and no stored session unless stated:
  - `logs in with the password and shows the due list`: fill „E-Mail“ and „Passwort“ in the form, press „Anmelden“, expect the heading „Fällig“.
  - `shows an error for a wrong password`: expect „Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen.“
  - `opens the due list again after logging out and back in` (the regression of PR #14, all browsers): log in, open the tab „Einstellungen“, press „Abmelden“, expect the heading „Anmelden“, log in again, expect „Fällig“ visible and the login page gone (`toHaveCount(0)` on the „Anmelden“ heading).
  - `sends logged-out visitors of protected pages to the login`: for `/material`, `/material/verwalten`, `/einstellungen` expect the URL `/login` and the heading „Anmelden“.
  - Chromium only (`test.skip(browserName !== 'chromium', ...)`): `adds a passkey and logs in with it`: attach a CDP virtual authenticator (`WebAuthn.enable`, `WebAuthn.addVirtualAuthenticator`: ctap2, internal, resident key, user verification, automatic presence simulation), log in with the password, open „Einstellungen“, fill „Name des Geräts“ and „Passwort“, press „Passkey hinzufügen“, expect „angelegt am“, press „Abmelden“, press „Mit Passkey anmelden“, expect „Fällig“.
  Use role, label and text locators (Playwright pierces shadow DOM), never CSS classes of Ionic internals.
- [ ] **Step 7: Write `navigation.spec.ts`**: with `authState('verwendung')`: the tab bar shows Start, Beförderungspapier, Material, Einstellungen; the due list shows the groups „Überfällig“, „Heute fällig“, „Bald fällig“ (seed data). With `authState('keine')`: the due list shows „Noch keine Kategorie freigegeben.“
- [ ] **Step 8: Wire the rest.** `vite.config.ts` test `exclude` gets `e2e/**` (keep vitest's defaults); typecheck covers the new files; `Makefile` target `e2e` runs `npm --prefix web run e2e` and is in `.PHONY`; `.gitignore` gets `web/test-results/`, `web/playwright-report/`, `web/e2e/.auth/`, `backend/.e2e/`; `CLAUDE.md` Commands gets `make e2e` with one line on `npx playwright install` and on `E2E_SKIP_BUILD=1`.
- [ ] **Step 9: Verify.** Run `npm --prefix web run typecheck`, `npm --prefix web test` (must not run e2e specs), and `make e2e` for all three browsers. Everything green, twice in a row (flakiness check); report the output of the second run.
- [ ] **Step 10: Commit** (`git add` only the listed files and the lock file).

---

### Task 2: CI job and docs

**Files:**
- Create: `.github/workflows/e2e.yml`
- Modify: `docs/superpowers/STATUS.md`, `CLAUDE.md` if Task 1 left a gap

**Interfaces:** consumes `npm run e2e` from Task 1.

- [ ] **Step 1: `e2e.yml`** modelled on `web.yml` and `go.yml`: `on: pull_request` with paths `web/**`, `backend/**`, `.github/workflows/e2e.yml`, and `workflow_call`; `concurrency` group `e2e-${{ github.ref }}` with `cancel-in-progress: true` and the same explanatory comment as `web.yml`; `permissions: contents: read`; one job on `ubuntu-latest` with `defaults.run.working-directory: web`: checkout, `actions/setup-go` with `go-version-file: backend/go.mod`, `actions/setup-node` (node 26, npm cache), `npm ci`, `npx playwright install --with-deps chromium firefox webkit`, `npm run e2e`, and on failure an upload of `web/playwright-report` and `web/test-results` with `actions/upload-artifact` (use a version that exists today; check the action's releases) with `retention-days: 7`. Do not add it to `image.yml`'s gate (the user decides that after it has run stably).
- [ ] **Step 2: Verify.** `actionlint` clean. Compare every `uses:` pin style with the existing workflows.
- [ ] **Step 3: Docs.** `STATUS.md`: add the suite under "Where things stand" (what it covers, that WebKit on Linux is not a real iPhone, passkey tests are Chromium-only, push delivery is not testable), under "Next steps" a line that `image.yml` may gate on it once stable, and that the other forms move to `IonInput` one by one with end-to-end coverage. One-line pointer in `CLAUDE.md` is enough.
- [ ] **Step 4: Commit.**

---

### Task 3: Einstellungen with Ionic components (branch `feature/settings-ionic-ui`, based on `test/e2e-playwright`)

**Files:**
- Create: `web/src/components/notificationText.ts`, `web/src/components/notificationText.test.ts`
- Modify: `web/src/components/NotificationSettings.tsx`, `web/src/pages/SettingsPage.tsx`, `web/src/pages/pages.test.tsx`, `web/src/test/ionic.ts` only if a helper is needed, `web/src/theme/variables.css` if small styles are needed

**Interfaces:**
- Produces, in `notificationText.ts` (pure, no React):

```ts
export const dayChips: { days: number; label: string }[]   // 14, 7, 3, 1, 0 -> '14','7','3','1','Am Tag'
export function toggleDay(timings: number[], days: number): number[]   // add or remove, keep values outside the chips, sort descending
export function summarize(timings: number[], weeklyOverdue: boolean): string
// '14, 3 Tage vorher · Am Tag · wöchentlich'; no timings and no weekly -> 'Keine Erinnerung'; only 0 -> 'Am Tag'
export function quietSummary(quiet: { from: string; until: string }): string   // '22:00 bis 07:00', or 'Aus' when both empty
```

- [ ] **Step 1: Write the failing tests** for the pure helpers in `notificationText.test.ts` (the examples above, plus: `toggleDay([14, 3, 0], 7)` -> `[14, 7, 3, 0]`; removing 3 -> `[14, 0]`; a value outside the chips such as 30 survives toggling another day; `summarize([], false)`, `summarize([0], false)` = 'Am Tag', `summarize([14, 3, 0], true)`, `summarize([7], true)` = '7 Tage vorher · wöchentlich'). Run them: they fail. Implement; they pass.
- [ ] **Step 2: Rework the page.** Layout, all in `IonList inset` groups, each with an `IonListHeader` (the iOS-style small header), the footer text as `IonNote` under the group. Order and German texts:
  1. no header: the user (name, e-mail) with an `IonIcon slot="start"` (`personCircleOutline`).
  2. **„Dieses Gerät“**: an `IonItem` with `IonIcon slot="start"` (`notificationsOutline`), `IonLabel` „Push-Nachrichten“ with a second line „Aktiv auf diesem Gerät“ or „Aus“, and an `IonToggle slot="end" color="success"` with an accessible name „Push-Nachrichten“. When push is on, a second item (`button`, no detail arrow, primary text) „Testnachricht senden“. Footer: on -> „Diese Geräte bekommen Erinnerungen, auch wenn die App geschlossen ist.“; off -> „Ohne Push auf diesem Gerät kommen keine Nachrichten an.“ For `needsInstall`, `unsupported` and server-not-set-up the toggle is disabled and off, and the footer is the existing explanatory sentence („Für Push-Nachrichten die App zum Home-Bildschirm hinzufügen: …“, „Dieser Browser unterstützt keine Push-Nachrichten.“, „Push ist auf diesem Server nicht eingerichtet.“).
  3. **„Erinnerungen“**: per permitted category an `IonItem` with `IonLabel` (category name; second line `summarize(...)` when on, „Aus“ when off) and an `IonToggle` (accessible name = category name). When on, directly below two more items in the same group: „Erinnerung vor Fälligkeit“ with the `dayChips` as `IonChip`s (selected: filled with a checkmark icon `checkmark` and `aria-pressed="true"`; not selected: outlined, `aria-pressed="false"`), and „Wöchentlich bei Überfälligem“ with an `IonToggle`. When off the group shows only the one quiet row, so the contrast is obvious. Footer: „Neue Fälligkeiten werden sofort gemeldet, wenn „Am Tag“ gewählt ist.“
  4. **„Ruhezeit“**: an item „Nicht stören“ with second line `quietSummary(...)` and an `IonToggle`. When on: two items „Von“ and „Bis“ each with a native `<input type="time">` in `slot="end"` (keep these native, in the `code-input` look only if needed; label them for assistive technology). Times save as soon as both are valid and changed; equal times show the red message „Von und Bis dürfen nicht gleich sein.“ and save nothing. Footer: „In dieser Zeit kommen keine Push-Nachrichten.“ The „Ruhezeit speichern“ button is removed. Turning it on uses the last entered times (default 22:00 to 07:00); turning it off saves empty times and keeps the entered values in state.
  5. **„Passkeys“**: the existing logic untouched, only restyled into rows (`IonIcon keyOutline` start, name, „angelegt am …“ second line, „Umbenennen“ and „Entfernen“ as small clear buttons) and the add form as items (`Field` for „Name des Geräts“ and „Passwort“, the buttons below). Do not change any passkey behaviour or strings.
  6. „Abmelden“ stays an `IonButton` (`expand="block"`, `fill="clear"`, `color="danger"`).
- [ ] **Step 3: Messages and failures.** Success and error messages are `IonNote` text in the footer of the group the action belongs to, with `role="status"` (success) or `role="alert"` (error). Every change sets the switch's busy state (all switches disabled while a save runs) and, **on failure as well as on success**, reloads the resource, so a switch never keeps a state the server doesn't have (Review Focus 1). A refused push permission (`PushDeniedError`) leaves the push switch off and shows „Benachrichtigungen sind im Browser blockiert.“ (Review Focus 2).
- [ ] **Step 4: Update `pages.test.tsx` and fakes.** The existing `describe('notification settings')` tests drive checkboxes and chips with `fireEvent`; under jsdom `IonToggle` cannot be driven. Keep (adapted) the tests that only render: categories listed with the right summary lines for a seeded setting and „Aus“ for none, the detail rows present only when on, quiet-time summary and the two time fields when on, the install guide on iOS, „Push ist auf diesem Server nicht eingerichtet.“, the test button present only when push is on, passkey tests unchanged. Delete the interaction tests that cannot run (toggling, chip clicks, quiet-time saving, test push); Task 4 re-creates each of them as an end-to-end test, one to one. List the deleted test names in the commit message. Check state through the toggle element's `checked` property and the rendered text; first confirm in a probe that the property is set under jsdom.
- [ ] **Step 5: Verify.** `npm --prefix web run typecheck` and `npm --prefix web test` pass. Do a manual check against the built app is not required here: Task 4 does it.
- [ ] **Step 6: Commit.**

---

### Task 4: End-to-end specs for Einstellungen and visual check

**Files:**
- Create: `web/e2e/settings.spec.ts`, `web/e2e/screens.spec.ts`
- Modify: `web/e2e/fixtures.ts` if a helper is missing, `docs/superpowers/STATUS.md`

**Interfaces:** consumes `authState`, `resetNotificationData` (Task 1) and the reworked page (Task 3).

- [ ] **Step 1: `settings.spec.ts`**, as `authState('verwendung')` unless stated, each test starting and ending with `resetNotificationData`. One test per deleted jsdom test of Task 3 plus the new ones; role and label locators (`getByRole('switch', { name })` where it works across the three engines, otherwise label text):
  - turning a category on shows its summary „14, 3 Tage vorher · Am Tag · wöchentlich“ and the detail rows, and the state survives a reload; turning it off hides them and shows „Aus“.
  - toggling the day chips changes the summary and survives a reload; a value set through the REST API outside the chips (30) survives toggling another chip.
  - the weekly switch changes the summary.
  - quiet time: default 22:00 to 07:00 when on; changing „Von“ and „Bis“ persists; equal times show the red message and a reload shows the old times (Review Focus 3); off then on restores the times.
  - a failing save flips the switch back and shows „Speichern fehlgeschlagen.“: use `page.route` to fail the request (Review Focus 1).
  - push: the „Dieses Gerät“ group shows the switch off with „Aus“ and the footer „Ohne Push auf diesem Gerät kommen keine Nachrichten an.“ (the e2e server has VAPID keys); Chromium only: with notification permission denied (the default in headless) turning it on leaves it off and shows „Benachrichtigungen sind im Browser blockiert.“ (Review Focus 2).
  - as `authState('keine')`: „Erinnerungen“ lists no categories (decide from the page what is shown and assert it; if the page shows an empty group, give it a sensible German hint in Task 3's component instead and say so in the report).
- [ ] **Step 2: `screens.spec.ts`**: writes PNG screenshots of Einstellungen (`fullPage`) to `test-results/screens/<project>-<state>.png` for the states: nothing enabled; one category enabled; quiet time on; only when `E2E_SCREENSHOTS=1` (skipped otherwise, so CI stays quick). WebKit (iPhone profile) gives the iOS-mode look, Chromium and Firefox the Material look.
- [ ] **Step 3: Verify.** `make e2e` green on all three browsers, twice in a row. Then run once with `E2E_SCREENSHOTS=1` and look at the PNGs yourself (Read them): check that on and off are distinguishable at first look in iOS and Material mode, that nothing overlaps or is cut off at 390 px width, and that texts are German. Fix what is wrong in Task 3's files and say so. Attach no screenshots to the commit.
- [ ] **Step 4: Docs.** `STATUS.md`: the Einstellungen rework done, the deferred review items it resolves (chips not keyboard-operable, messages without roles, busy guard, Ruhezeit save button) removed from the phase 4 list, and what remains for other forms.
- [ ] **Step 5: Commit.**
