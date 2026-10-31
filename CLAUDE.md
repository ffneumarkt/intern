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
  (`ionButton`, `ionTab`, `ionChip`, `findIon`) and inputs are driven with `fireEvent`; jsdom does not model
  Ionic's shadow DOM roles or focus. `web/src/api/` is replaced by `test/fakeAuth.ts`,
  `test/fakeMaterial.ts`, `test/fakePasskeys.ts`, `test/fakeNotifications.ts` and `test/fakePush.ts`.
- Form fields are native inputs through `web/src/components/Field.tsx`, not `IonInput`/`IonSelect`.
- Data pages load with `useResource`, not an effect: Ionic keeps pages mounted.
- Never redirect from a page or route element (`<Navigate>`): Ionic keeps visited pages mounted, so each
  one would redirect and the stack breaks (the next login stays on the login page in Firefox). Redirect in
  one place, as `LoginRedirect` in `App.tsx` does.
- Go tests that use `internal/testenv` live in external `_test` packages.
- TDD: write the failing test first, watch it fail, then implement.
- Work on a branch, open a PR against `main`; the user merges.
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
make build     # frontend into backend/ui/dist + binary backend/intern
make image     # docker build -t intern:local .
```

Push needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (from `intern vapid`) and `VAPID_SUBJECT` set for
`make dev-api`. Vite's dev server registers no service worker, so test push against `make build` output.

`make test` does not run the security scans: `govulncheck ./...` in `backend/`, `npm audit` in `web/`,
and `actionlint` after changing a workflow.
