# Barcode scanning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members scan manufacturer codes with the camera in "Verwendung erfassen" and as quick search on the due list; a `manage` user assigns an unknown code to an item; the placeholder QR label page goes away.

**Architecture:** A `Scanner` component (over a `useCamera` hook and a lazily loaded `barcode-detector` module in `web/src/scan/`) reports codes through `onCode`. Both pages use it; tests replace it with `test/fakeScanner.ts`. An `AssignCode` component saves a scanned code on an item through a new `assignBarcode` API call. Item matching moves into `web/src/material/items.ts` so both pages and the assign list share it.

**Tech Stack:** Ionic React 9, `barcode-detector` (zxing-wasm), Vitest + jsdom, Playwright (Chromium fake camera).

**Spec:** `docs/superpowers/specs/2026-11-24-barcode-scanning-design.md` (refines §8/§9 of the platform design).

## Global Constraints

- `CLAUDE.md` conventions: TDD (failing test first, watch it fail), UI text German only, code and comments English, test helpers from `web/src/test/ionic.ts`, `useResource` for data, no `<Navigate>` in pages, Ionic components found by text.
- No label generation, no printing; codes are manufacturer-supplied. Retired items are never matched by a scan.
- Formats: `qr_code`, `data_matrix`, `code_128`, `ean_13`, `ean_8`. Camera choice stored under `localStorage` key `intern.camera`, wrapped in try/catch.
- The wasm is self-hosted (never a CDN) and precached; the scanner code loads with a dynamic `import()`.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Work on branch `feature/barcode-scanning` in `/home/rloi/repo/intern`; no worktree; do not push; leave the user's dev servers (8090, 5173) alone; e2e uses 8099.
- `make test` stays browser-free; also run `govulncheck`/`npm audit` per `CLAUDE.md` after adding the dependency.

## Review Focus

1. Camera permission denied, no camera, or an insecure context: a German hint shows and manual entry still works. (Task 3)
2. The camera really stops when leaving the page, closing the modal or unmounting; Ionic keeps pages mounted. (Task 3)
3. One physical code held in front of the camera adds the item once, not on every frame. (Task 3, 4)
4. Assigning a code that another item already has shows the existing barcode-taken message and changes nothing. (Task 2, 4)
5. A scanned code of a retired item is "Nicht gefunden", not silently added. (Task 4, 5)

---

### Task 1: Remove the QR label page

**Files:**
- Delete: `web/src/pages/LabelPage.tsx`
- Modify: `web/src/App.tsx` (import line 12, route line 63), `web/src/routes.ts` (`label`), `web/src/pages/ItemPage.tsx` (the „Etikett drucken“ button), `web/src/theme/variables.css` (`.label-preview`, `.qr-placeholder` rules), `web/src/pages/pages.test.tsx:212`

**Interfaces:** Produces: no `paths.label`, no `/etikett` route.

- [ ] **Step 1: Change the test** at `pages.test.tsx:212` (item detail for a `manage` user) to assert `expect(button('Etikett drucken')).not.toBeInTheDocument()` and keep the surrounding assertions; run `npx vitest run src/pages/pages.test.tsx -t "<that test name>"` in `web/` and see it fail.
- [ ] **Step 2: Delete** the page, route, `paths.label`, button and the two CSS rules; grep for `etikett`/`label(` to confirm nothing else references them.
- [ ] **Step 3: Run** `npm --prefix web test` and `npm --prefix web run typecheck`; both pass.
- [ ] **Step 4: Commit** `remove the QR label placeholder page`.

### Task 2: Item matching, `assignBarcode` and `AssignCode`

**Files:**
- Create: `web/src/material/items.ts`, `web/src/material/items.test.ts`, `web/src/components/AssignCode.tsx`, `web/src/components/AssignCode.test.tsx`
- Modify: `web/src/api/material.ts`, `web/src/test/fakeMaterial.ts`, `web/src/pages/RecordUsePage.tsx` (use the moved helpers)

**Interfaces:**
- Produces in `material/items.ts`: `findByBarcode(items: Item[], code: string): Item | undefined` (active items only, exact code) and `searchItems(items: Item[], text: string, excludeIds: string[]): Item[]` (both moved unchanged from `RecordUsePage.tsx`).
- Produces in `api/material.ts` and the fake: `assignBarcode(itemId: string, barcode: string): Promise<void>` — `pb.collection('items').update(itemId, { barcode })`, errors through `explainItemError` (so a taken code throws `BarcodeTakenError`). The fake records `calls.assigned: { itemId: string; barcode: string }[]`, sets `barcode` on the item in `data.items`, honours `failing.barcode`, and `resetMaterial` clears the calls.
- Produces: `AssignCode({ code, items, onAssigned })` where `onAssigned(item: Item): void`. Renders a button „Gerät zuordnen“; pressed, it shows a „Gerät suchen“ field (`Field`) and a list of active items matching the text (all active items when empty), items without a barcode first; tapping one calls `assignBarcode`, then `onAssigned({ ...item, barcode: code })`. On `BarcodeTakenError` it shows its message and does not call `onAssigned`.

- [ ] **Step 1: Write failing tests.** `items.test.ts`: `findByBarcode` ignores retired items and needs an exact code; `searchItems` matches name or code case-insensitively and excludes ids (move the existing behaviour's cases from `pages.test.tsx` only if they exist there; otherwise write these). `AssignCode.test.tsx` (mock `../api/material` with the fake): lists items without a code before items with one; picking „Maske 01“ calls `assignBarcode('m01', 'NEW-1')` and `onAssigned` gets that item with the code; with `failing.barcode = true` the `BarcodeTakenError` text shows and `onAssigned` is not called.
- [ ] **Step 2: Run** `npx vitest run src/material src/components/AssignCode.test.tsx` in `web/`; fails (modules missing).
- [ ] **Step 3: Implement** the three units as specified; `RecordUsePage.tsx` imports `findByBarcode` and `searchItems` from `../material/items`. Use `useDialogs`-free inline state; text in German.
- [ ] **Step 4: Run** `npm --prefix web test`; all pass.
- [ ] **Step 5: Commit** `assign an unknown code to an item`.

### Task 3: Detector, `useCamera` and `Scanner`

**Files:**
- Create: `web/src/scan/detector.ts`, `web/src/scan/useCamera.ts`, `web/src/components/Scanner.tsx`, `web/src/scan/useCamera.test.tsx`, `web/src/components/Scanner.test.tsx`
- Modify: `web/package.json` (add `barcode-detector` pinned to the current exact version), `web/vite.config.ts` (add `wasm` to workbox `globPatterns`), `web/src/theme/ui.css` (preview styles)

**Interfaces:**
- Produces in `scan/detector.ts`: `loadDetector(): Promise<{ detect(source: HTMLVideoElement): Promise<string[]> }>` — dynamic `import('barcode-detector/ponyfill')`, calls `prepareZXingModule` with a `locateFile` returning the wasm imported via `?url` from `zxing-wasm/reader` (verify the exact export names against the installed version), creates `BarcodeDetector` with the five formats, maps results to `rawValue` strings. Cached after the first call.
- Produces in `scan/useCamera.ts`: `useCamera(active: boolean): { videoRef: RefObject<HTMLVideoElement | null>; devices: MediaDeviceInfo[]; deviceId: string | null; selectDevice(id: string): void; torch: { supported: boolean; on: boolean; toggle(): void }; error: string | null }`. Requests `{ video: { facingMode: 'environment' } }` (or the remembered `deviceId` from `intern.camera`), lists `videoinput` devices after permission, stops all tracks when `active` is false or on unmount. `error` is „Kamerazugriff verweigert“ (`NotAllowedError`), „Keine Kamera gefunden“ (`NotFoundError`), else „Kamera nicht verfügbar“ (also when `navigator.mediaDevices` is missing).
- Produces: `Scanner({ onCode, active = true })` default export of `components/Scanner.tsx`: `<video playsInline muted>`, a camera `SelectField` only when `devices.length > 1`, a „Taschenlampe“ toggle only when `torch.supported`, the `error` text with `role="status"`. Detection loop on `requestAnimationFrame`, at most one detection per 200 ms, reports a code when it differs from the last reported one or after it was absent for a detection pass; calls `navigator.vibrate?.(100)` on each report. Also stops when the host page leaves (`useIonViewWillLeave` inside the component setting an internal paused flag; `useIonViewWillEnter` clears it).

- [ ] **Step 1: Write failing tests** with a fake `navigator.mediaDevices` (`getUserMedia` returning a stream with a stoppable track, `enumerateDevices`) and `vi.mock('../scan/detector')` whose `detect` is scripted. `useCamera.test.tsx`: requests the environment camera first; remembered `intern.camera` is requested as `deviceId` and a changed choice is saved; `NotAllowedError` → „Kamerazugriff verweigert“; `NotFoundError` → „Keine Kamera gefunden“; missing `mediaDevices` → „Kamera nicht verfügbar“; tracks stop on `active=false` and on unmount; torch only reported supported when `track.getCapabilities().torch`. `Scanner.test.tsx`: a code detected on consecutive frames calls `onCode` once; a different code calls it again; the same code after an empty pass calls it again; picker hidden with one device and shown with two; error text shown with `role="status"`; `vibrate` called per report. Use `vi.useFakeTimers` with `requestAnimationFrame` faked.
- [ ] **Step 2: Run** `npx vitest run src/scan src/components/Scanner.test.tsx`; fails.
- [ ] **Step 3: Install and implement.** `npm --prefix web install --save-exact barcode-detector`; implement the three modules; add `wasm` to workbox `globPatterns`.
- [ ] **Step 4: Run** `npm --prefix web test`, `typecheck`, then `make build` and check the wasm is emitted into `backend/ui/dist` and listed in the generated `sw.js`; start `backend/intern` on a free port (or reuse `make e2e` later) and `curl -sI` the wasm URL for `content-type: application/wasm`. If the Go server serves another type or a CSP blocks it, fix it in `backend/internal/server` with a test in the same package.
- [ ] **Step 5: Run** `npm --prefix web audit` and `govulncheck ./...` in `backend/`; report findings.
- [ ] **Step 6: Commit** `add a camera scanner for barcodes`.

### Task 4: Scan in "Verwendung erfassen"

**Files:**
- Create: `web/src/test/fakeScanner.ts`
- Modify: `web/src/pages/RecordUsePage.tsx`, `web/src/pages/pages.test.tsx`

**Interfaces:**
- Produces in `fakeScanner.ts`: default export `Scanner({ onCode, active })` (renders `<div data-testid="scanner" />` only when `active !== false` and remembers `onCode` and `active` in module state), `scanCode(code: string): void` (calls the latest `onCode` inside `act`), `scannerActive(): boolean`; `resetScanner()` called from `test/setup.ts`. Tests mock it with `vi.mock('../components/Scanner', () => import('../test/fakeScanner'))`.
- Consumes: `Scanner`, `AssignCode`, `findByBarcode`.

- [ ] **Step 1: Write failing tests** in `pages.test.tsx` (record use, via `scanCode`): a known code adds the item; the same code twice adds it once; a retired item's code shows „Nicht gefunden: <code>“; an unknown code as a `use` user shows „Nicht gefunden“ without „Gerät zuordnen“; as `manage` the card has „Gerät zuordnen“ and assigning „Maske 01“ adds it to the list and records `calls.assigned`; a taken code (`failing.barcode`) shows the barcode-taken message and does not add; the scanner is not active in the form step (`scannerActive()` false after „Fertig“).
- [ ] **Step 2: Run** the new tests; fail.
- [ ] **Step 3: Implement** in `RecordUsePage`: `<Scanner onCode={handleCode} active={step === 'scan'} />` in the card above the manual field; `handleCode` shares the lookup with `submitCode` (known → `add`, unknown → `setUnknown`); replace the `routerLink` „Gerät zuordnen“ button with `<AssignCode code={unknown} items={items} onAssigned={(item) => { add(item); setUnknown(null) }} />` for `manage` users.
- [ ] **Step 4: Run** `npm --prefix web test`; pass.
- [ ] **Step 5: Commit** `scan devices when recording a use`.

### Task 5: Quick search on the due list

**Files:**
- Create: `web/src/components/ScanSearch.tsx`
- Modify: `web/src/pages/DueListPage.tsx`, `web/src/pages/pages.test.tsx`

**Interfaces:**
- Produces: `ScanSearch({ items })` renders a „Scannen“ button (barcode icon) that opens an `IonModal` titled „Gerät scannen“ with `<Scanner onCode=… active={open} />` and a „Schließen“ button. Known (active) item → close the modal and `navigate(paths.item(item.id))`; unknown → „Nicht gefunden: <code>“ in the modal, with `AssignCode` for `manage` users, after which it opens the item. The due list renders it in the chips area (`items` from the page's resource).

- [ ] **Step 1: Write failing tests** (fakeScanner mocked): pressing „Scannen“ shows the scanner (`scannerActive()` true); a known code navigates to the item page (its name shows); an unknown code shows „Nicht gefunden“; a retired item's code is unknown; „Schließen“ makes `scannerActive()` false; as `manage`, assigning then opens the item.
- [ ] **Step 2: Run**; fail.
- [ ] **Step 3: Implement** `ScanSearch` and add it to `DueListPage`; reuse `findByBarcode`. Close the modal before navigating.
- [ ] **Step 4: Run** `npm --prefix web test`; pass.
- [ ] **Step 5: Commit** `find an item by scanning from the due list`.

### Task 6: End-to-end test, spec and status

**Files:**
- Create: `web/e2e/scan.spec.ts`, `web/e2e/fixtures/qr.y4m` (the conversion command goes in a comment in `scan.spec.ts`)
- Modify: `web/playwright.config.ts` (Chromium project only: `launchOptions.args` `--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`, `--use-file-for-fake-video-capture=<abs path of qr.y4m>`; `permissions: ['camera']`), `docs/superpowers/specs/2026-10-29-intern-platform-design.md` (§8 QR label row removed; §9 says manufacturer codes only, no generation; the quick-search and assign bullets point to the new design doc), `docs/superpowers/STATUS.md` (phase 5 done, branch/PR pending, what was not observed: real iPhone/Android cameras, torch, Surface webcam, scan speed on worn codes; update Next steps)

**Interfaces:** Consumes the seeded data (`make seed`; check `backend/internal/devseed/devseed.go` for an item whose code the fixture QR can encode, or create a throwaway item through the API like `forms.spec.ts` and remove it with `removeItemWithHistory`).

- [ ] **Step 1: Make the fixture:** a QR PNG encoding a fixed test code (generate once with any local tool, e.g. `python -c` with `qrcode` or `qrencode` if installed), converted with `ffmpeg -loop 1 -i qr.png -t 3 -pix_fmt yuv420p qr.y4m`; commit the small file.
- [ ] **Step 2: Write `scan.spec.ts`.** Chromium only (`test.skip(browserName !== 'chromium')` for the real scan): as `verwaltung`, create a throwaway item with the fixture's code, open „Verwendung erfassen“, expect the item in the „Gescannte Geräte“ list without typing, then clean up. Chromium: also assign — an item without a code, unknown fixture code → „Gerät zuordnen“ → picked item holds the code. All browsers: the page loads and manual entry works; with camera permission denied (`context.clearPermissions()` plus no fake flags is not possible in Firefox/WebKit, so there simply assert the page and manual entry work and the preview or the hint is shown).
- [ ] **Step 3: Run** `npm --prefix web run e2e -- --project=chromium --project=firefox scan.spec.ts`, then the whole suite for both projects; all pass. WebKit runs in CI.
- [ ] **Step 4: Update the docs** as listed, then run `make test`.
- [ ] **Step 5: Commit** `test scanning end to end and update the docs`.
