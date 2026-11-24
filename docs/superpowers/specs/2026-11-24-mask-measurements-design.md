# Mask measurements on a check: design

Replaces the paper „AS-Masken Betriebsnachweis“ columns „Masken-Dichtprüfung“ and „Öffnungsdruck
Ausatemventil“ with entered values. Extends §3 (data model) and §8 (record check) of
`2026-10-29-intern-platform-design.md`.

## Behaviour

- A check type has a switch **„Messwerte erfassen“** (`check_types.measurements`, set in Verwalten; on for the
  seeded „Maskenprüfung“). Other check types are unchanged.
- „Prüfung erfassen“ for such a type shows two blocks (German, with the printed criterion as hint):
  - **Dichtprüfung** („−10 mbar → max. 1 mbar/60 s trocken“): „Startdruck (mbar)“ prefilled with −10 and
    editable; a button „60 s starten“ (enabled with a valid start value) that runs a countdown; „Druck nach
    60 s (mbar)“. The app shows „Verlust: x mbar“ = how far the pressure moved toward 0 (|start| − |end|), ✓ at 1 mbar or less, otherwise a red hint. A reading that is further from 0 than the start, or on the other side of 0, is impossible for a leak: it is marked invalid at once, shows no verdict and cannot be saved.
  - **Öffnungsdruck Ausatemventil** („4,2–6,0 mbar bei 10 l/min, EN 137“): one value in mbar; ✓ within
    4,2–6,0, otherwise a hint naming the missed limit.
- Numbers accept comma or dot (`-0,5`, `5.1`) and show with a comma.
- **Countdown:** based on a start timestamp (not on counting ticks), so a locked screen or a throttled tab
  does not slow it; it asks the browser to keep the screen awake (Wake Lock) where supported and vibrates at 0
  where supported; a „Neu starten“ button restarts it; it stops and resets when the page is left.
- **Ergebnis:** with both values entered it is preselected: Bestanden if both are within the limits, else
  Mangel. The user can change it. Changing a value preselects again until the user has picked a result by hand.
- Both measurements are required while the switch is on (client side; the server accepts the fields empty).
- History entries of such checks show the values, e.g. „Dichtheit −10 → −9 mbar (Verlust 1), Öffnungsdruck
  5,1 mbar“, next to the existing detail.

## Data

- `check_types.measurements` (bool). `checks.leak_start_mbar`, `checks.leak_end_mbar`,
  `checks.opening_pressure_mbar` (optional numbers). The loss is derived, never stored. One migration;
  existing checks stay empty.
- Limits are constants in the app: leak loss ≤ 1 mbar, opening pressure 4,2–6,0 mbar. The same limit applies
  to „Überdruck“ masks because the distance from 0 is used (10 → 9 is a loss of 1).

## Out of scope

Per-type limits, other measurements, server-side requirement of the values, the paper columns „Einsatz/Übung
(min)“, „Standort“ and „Unterschrift“, printing the sheet.

## Testing

Pure functions (parse, loss, limits, formatting), the countdown hook with fake timers, the form (values,
countdown, result suggestion, override, required), the Verwalten switch, the API mapping, the migration; a
Playwright test that records a measured check in a real browser.
