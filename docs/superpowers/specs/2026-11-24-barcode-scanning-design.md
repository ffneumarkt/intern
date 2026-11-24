# Barcode scanning (phase 5): design

Refines §8 and §9 of `2026-10-29-intern-platform-design.md`; where they differ, this document wins.

## Goal

Members scan equipment with the phone or Surface camera instead of typing codes. Codes are the
manufacturers' own: **the system prints no labels** and generates no codes. Items get their code by
assigning an unknown scanned code to an item.

## Scope

In: camera scanner component, scanning in "Verwendung erfassen", scanning as quick search on the due
list, assigning an unknown code to an item, removal of the QR label page.
Out: label generation or printing, handheld scanners, `IonDatetime`.

## Components

### `web/src/components/Scanner.tsx` and `useCamera`

- Props: `onCode(code: string)`, optional `active` (false stops the camera). Renders the preview, a camera
  picker (only with more than one camera) and a torch toggle (only where the track reports `torch`).
- Camera: `getUserMedia({ video: { facingMode: 'environment' } })`; the choice of camera is remembered in
  `localStorage` (`intern.camera`, try/catch like `recordedBy`).
- Detection: `barcode-detector` ponyfill, formats `qr_code`, `data_matrix`, `code_128`, `ean_13`, `ean_8`,
  `requestAnimationFrame` loop throttled to about 5 detections per second. The same code is reported once
  until it has left the frame; any new report vibrates where `navigator.vibrate` exists.
- Lifecycle: the camera and the loop stop when `active` turns false, on `useIonViewWillLeave` of the host
  page, and on unmount (Ionic keeps pages mounted).
- Errors (German hint, manual entry stays usable): `NotAllowedError` → „Kamerazugriff verweigert“,
  `NotFoundError` → „Keine Kamera gefunden“, anything else → „Kamera nicht verfügbar“.
- The library and its wasm load with a dynamic `import()` (own chunk, not in the first load). The wasm is
  self-hosted (imported with `?url`, `prepareZXingModule` `locateFile`), never fetched from a CDN, and
  added to workbox `globPatterns` so scanning works from the precache.

### Item search

`searchItems` moves from `RecordUsePage` to `web/src/material/searchItems.ts` (same behaviour) so the
assign list reuses it.

### Assign a code (`AssignCode` component)

Shown for an unknown code to `manage` users ("Gerät zuordnen"). A searchable list of active items without
a code first, then the rest. Picking one saves `barcode` on that item (`updateItem`-style call in
`api/material.ts`), then reports the item to the caller. A taken code shows the existing
`BarcodeTakenError` message. Non-`manage` users see only „Nicht gefunden: <code>“.

## Flows

- **Verwendung erfassen:** Scanner above the manual field. Known code → item added (duplicates ignored).
  Unknown code → „Nicht gefunden“ card with the assign option; after assigning, the item is added to the
  list. Manual entry and suggestions stay as they are.
- **Quick search (due list):** a „Scannen“ button opens the scanner in a modal. Known code → navigate to
  the item page. Unknown code → „Nicht gefunden“ with the assign option; after assigning, open the item.
- Retired items are never matched by a scan (as in manual entry).

## Removal

`LabelPage`, its route in `routes.ts`/`App.tsx`, the link on the item page, `.qr-placeholder` CSS and
their tests. Spec §8 (QR label row) and §9 are updated: manufacturer codes only, no generation. STATUS.md
is updated.

## Testing

- TDD, vitest: `test/fakeScanner.ts` replaces `Scanner` with `scan('CODE')`. Page tests for both flows
  (known, duplicate, unknown, assign, taken code, non-manage user). `Scanner`/`useCamera` tests against a
  fake `MediaDevices` and detector: throttle and dedupe, permission denied, no camera, torch only when
  supported, camera stopped on leave.
- Playwright: Chromium only runs a real scan (`--use-fake-device-for-media-stream
  --use-fake-ui-for-media-stream --use-file-for-fake-video-capture` with a QR `y4m` fixture, real wasm
  decode). Firefox and WebKit check that the page loads, the denied-permission hint shows and manual entry
  works.
- Verified in the built binary: `.wasm` is served as `application/wasm` and no CSP blocks it.

## Not observable here (STATUS.md)

Real iPhone Safari and Android cameras, torch on hardware, the Surface webcam, scan speed on worn
manufacturer codes.
