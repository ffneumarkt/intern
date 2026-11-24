# FF Intern

Internal tools for FF Neumarkt at `intern.ffneumarkt.at`. Start with `docs/superpowers/STATUS.md`
(current state, next steps), then the spec `docs/superpowers/specs/2026-10-29-intern-platform-design.md`.

## Conventions

- Layout: Go module in `backend/` (`github.com/ffneumarkt/intern/backend`), Ionic React app in `web/`,
  only tooling at the root. Vite builds into `backend/ui/dist`, which is embedded in the binary.
- Logging in Go: always `charmbracelet/log` via `internal/logging` (ReportCaller, ReportTimestamp,
  TimeFormat `15:04:05.00`, level from `LOG_LEVEL`). No `log`/`fmt.Print` for diagnostics.
- UI text is German only; code, comments and identifiers are English.
- Routes are defined once in `web/src/routes.ts` (`paths`).
- Frontend tests: Ionic components are found by visible text with `web/src/test/ionic.ts`
  (`ionButton`, `ionTab`, `ionChip`, `ionItem`, `ionToggle`, `findIon`) and inputs are driven with `fireEvent`;
  jsdom does not model Ionic's shadow DOM roles or focus. Ionic controls can be tested in jsdom (props such
  as `checked` reach the element, a click on an `ion-toggle` fires `onIonChange`) thanks to the `@lit/react`
  alias in `web/vite.config.ts`; real-browser behaviour is covered by `make e2e`. `web/src/api/` is replaced by `test/fakeAuth.ts`,
  `test/fakeMaterial.ts`, `test/fakePasskeys.ts`, `test/fakeNotifications.ts`, `test/fakePush.ts` and `test/fakeTransport.ts`.
- Form fields go through `web/src/components/Field.tsx`, which wraps `IonInput`, `IonTextarea`, `IonSelect`
  and `IonToggle`; tests drive them with `typeInto` (`fireEvent.change` does not reach Ionic inputs),
  `choose` (find selects with `ionSelect`, their text with `selectedText`) and `setToggle` from
  `web/src/test/ionic.ts`. Plain text fields get capitalisation, autocorrect and spellcheck (Ionic turns
  them off by default); code-like ones (codes, serial numbers) pass `autoCapitalize="off"`. Dates are
  `IonInput type="date"` (the OS picker); only the Ruhezeit times stay native `<input type="time">`.
- Required fields: pass `required` (a red * after the label, drawn in CSS so labels stay findable) and `error` to
  `Field`, `SelectField` and `TextAreaField`. A form never disables Speichern for an empty field: the first press
  sets a `tried` flag, the empty fields show `requiredMessage` ('Bitte ausfüllen.'), nothing is saved, and
  `showFirstInvalid()` (`components/required.ts`) scrolls to the first one without taking the focus (it would start Ionic's iOS input shim).
- Shared UI pieces live once in `web/src/components/ui.tsx`: `ErrorText` (red message, renders nothing when empty,
  optional `role`), `ActionBar` (sticky bar at the page bottom), `Hint` (muted paragraph), `Card` (`tone="warning"`)
  and `BlockButton` (full-width `IonButton`); inside a list use `ListNote` (an Ionic item, so it takes the list's
  padding). Pages use these instead of repeating the Ionic element and its `ui-*` classes; their look is in
  `web/src/theme/ui.css`.
- Confirm and prompt dialogs are IonAlerts through `useDialogs` (`web/src/components/useDialogs.ts`), never
  `window.confirm`/`prompt`; tests press the alert buttons with `alertButton` from `web/src/test/ionic.ts`.
- Data pages load with `useResource`, not an effect: Ionic keeps pages mounted.
- Never redirect from a page or route element (`<Navigate>`): Ionic keeps visited pages mounted, so each
  one would redirect and the stack breaks (the next login stays on the login page in Firefox). Redirect in
  one place, as `LoginRedirect` in `App.tsx` does.
- Go tests that use `internal/testenv` live in external `_test` packages.
- TDD: write the failing test first, watch it fail, then implement.
- Work on a branch, open a PR against `main`. A PR by the owner or Dependabot merges itself once every check is
  green (`.github/workflows/automerge.yml`, `.github/scripts/automerge.sh`); the user merges the rest: drafts, PRs
  with the `no-automerge` label, PRs that change workflow files (the built-in token may not merge those) and docs-only
  PRs (no check runs). To keep a PR from merging itself, open it as a draft or add `no-automerge`.
- A reusable workflow's `concurrency` group is named literally: `github.workflow` there is the caller's
  name, and a shared group would make the two cancel each other.

## Commands

```sh
make dev-api   # backend on :8090, admin UI at /_/; passkeys need http://localhost:5173 or :8090, not an IP
make dev-web   # Vite dev server, proxies /api and /_
make debug     # dev-api and dev-web together with LOG_LEVEL=debug
make seed      # sample data in backend/pb_data, users keine@, verwendung@, pruefung@,
               # verwaltung@ffneumarkt.local, password intern-dev-1234
make test      # go vet + go test, tsc, vitest
make e2e       # Playwright in Chromium, Firefox, WebKit against the built binary on :8099 with a
               # seeded temp data dir; once: cd web && npx playwright install chromium firefox webkit;
               # on Arch WebKit needs the Playwright Docker image: npm --prefix web run e2e --
               # --project=chromium --project=firefox; CI (e2e.yml) runs all three, one job per browser in parallel
               # E2E_SKIP_BUILD=1 reuses the last frontend and binaries in backend/.e2e
make build     # frontend into backend/ui/dist + binary backend/intern
make image     # docker build -t intern:local .
```

Push needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (from `intern vapid`) and `VAPID_SUBJECT` set for
`make dev-api`. Vite's dev server registers no service worker, so test push against `make build` output.

`make test` does not run the security scans: `govulncheck ./...` in `backend/`, `npm audit` in `web/`,
and `actionlint` after changing a workflow.
