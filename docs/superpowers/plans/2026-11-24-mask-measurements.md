# Mask measurements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Record the Dichtprüfung (start pressure, 60 s countdown, end pressure) and the Öffnungsdruck on a mask check, with limits and a suggested result.

**Spec:** `docs/superpowers/specs/2026-11-24-mask-measurements-design.md`

**Stack:** PocketBase migration (Go), Ionic React, Vitest, Playwright. TDD; German UI, English code; commits end with the `Co-Authored-By` line; branch `feature/mask-measurements`.

## Tasks

1. **Backend:** migration `1793380008_check_measurements.go` (fields above); test in `migrations/` that the fields exist and a check saves with them; seed „Maskenprüfung“ with `measurements: true`.
2. **Pure logic** `web/src/material/measurements.ts`: `parseMbar(text): number | null`, `formatMbar(n): string` (comma), `leakLoss(start, end): number`, `leakOk(loss)`, `openingOk(v)`, `openingHint(v)`, constants; tests first.
3. **Countdown** `web/src/material/useCountdown.ts`: `useCountdown(seconds)` → `{ remaining, running, done, start(), reset() }`, timestamp based, vibrates and releases wake lock at 0; tests with fake timers.
4. **API:** `CheckType.measurements`, `CheckTypeInput.measurements`, `CheckInput` gets optional `leakStartMbar`, `leakEndMbar`, `openingPressureMbar`; `recordCheck`, `listCheckTypes`, `listHistory` detail; fake and fixtures updated.
5. **UI:** `components/Measurements.tsx` used by `RecordCheckPage` (blocks, countdown, ✓/hints, required, result suggestion with manual override); Verwalten toggle in `CheckTypeForm`.
6. **E2E and docs:** `web/e2e/measurements.spec.ts` (all browsers; the countdown with a short override is not possible, so the test starts it and enters the end value without waiting), STATUS.md, spec cross references.
