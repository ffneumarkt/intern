# FF Intern

Internal tools of FF Neumarkt at `intern.ffneumarkt.at`: Beförderungspapier (public, offline) and
material check intervals. Go + PocketBase backend with an embedded Ionic React frontend.

Design: `docs/superpowers/specs/2026-10-29-intern-platform-design.md` · Status and next steps: `docs/superpowers/STATUS.md`

## Development

```sh
make dev-api                                # backend on http://127.0.0.1:8090, admin UI at /_/
make dev-web                                # frontend dev server, proxies /api and /_ to the backend
make debug                                  # both of the above together with LOG_LEVEL=debug
make seed                                   # sample data, see below
make test                                   # go vet + go test, typecheck, vitest
make image                                  # build the Docker image
```

Passkeys only work at `http://localhost:5173`: WebAuthn does not accept an IP address such as `127.0.0.1`.
Production needs no configuration; other sites set `PASSKEY_RP_ID` and `PASSKEY_ORIGIN` (comma separated).

`make seed` fills `backend/pb_data` with sample data. Log in as `keine@`, `verwendung@`, `pruefung@` or
`verwaltung@ffneumarkt.local` with the password `intern-dev-1234`, one user per permission level.

The backend logs with `charmbracelet/log`; set `LOG_LEVEL` (`debug`, `info`, `warn`, `error`; default `info`).

