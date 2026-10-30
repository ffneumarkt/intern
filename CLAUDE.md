# FF Intern

Internal tools for FF Neumarkt at `intern.ffneumarkt.at`. Start with `docs/superpowers/STATUS.md`
(current state, next steps), then the spec `docs/superpowers/specs/2026-10-29-intern-platform-design.md`.

## Conventions

- Layout: Go module in `backend/` (`github.com/ffneumarkt/intern/backend`), Ionic React app in `web/`,
  only tooling at the root. Vite builds into `backend/ui/dist`, which is embedded in the binary.
- Logging in Go: always `charmbracelet/log` via `internal/logging` (ReportCaller, ReportTimestamp,
  TimeFormat `15:04:05.00`, level from `LOG_LEVEL`). No `log`/`fmt.Print` for diagnostics.
- UI text is German only; code, comments and identifiers are English.
- Sketch-only code lives in `web/src/sketch/` and gets replaced by real data, not extended into it.
- Routes are defined once in `web/src/routes.ts` (`paths`).
- Frontend tests: Ionic components are found by visible text with `web/src/test/ionic.ts`
  (`ionButton`, `ionTab`, `findIon`) and inputs are driven with `fireEvent`; jsdom does not model
  Ionic's shadow DOM roles or focus.
- TDD: write the failing test first, watch it fail, then implement.
- Work on a branch, open a PR against `main`; the user merges.

## Commands

```sh
make dev-api   # backend on :8090, admin UI at /_/
make dev-web   # Vite dev server, proxies /api and /_
make debug     # dev-api and dev-web together with LOG_LEVEL=debug
make seed      # sample data in backend/pb_data, users keine@, verwendung@, pruefung@,
               # verwaltung@ffneumarkt.local, password intern-dev-1234
make test      # go vet + go test, tsc, vitest
make build     # frontend into backend/ui/dist + binary backend/intern
make image     # docker build -t intern:local .
```
