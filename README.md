# FF Intern

Internal tools of FF Neumarkt at `intern.ffneumarkt.at`: Beförderungspapier (public, offline) and
material check intervals. Go + PocketBase backend with an embedded Ionic React frontend.

Design: `docs/superpowers/specs/2026-10-29-intern-platform-design.md`

## Development

```sh
make dev-api                                # backend on http://127.0.0.1:8090, admin UI at /_/
make dev-web                                # frontend dev server, proxies /api and /_ to the backend
make test                                   # go vet + go test, typecheck, vitest
make image                                  # build the Docker image
```

The UI sketch can be opened at a permission level with `?ansicht=public|use|check|manage`.

The backend logs with `charmbracelet/log`; set `LOG_LEVEL` (`debug`, `info`, `warn`, `error`; default `info`).

