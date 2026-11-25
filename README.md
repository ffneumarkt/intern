# FF Intern

Internal tools of FF Neumarkt at `intern.ffneumarkt.at`: Beförderungspapier (public, offline) and
material check intervals. Go + PocketBase backend with an embedded React frontend (Tailwind, shadcn-style components).

Design: `docs/superpowers/specs/2026-10-29-intern-platform-design.md` · Status and next steps: `docs/superpowers/STATUS.md`

## Development

```sh
make dev-api                                # backend on http://127.0.0.1:8090, PocketBase dashboard at /_/ (local only)
make dev-web                                # frontend dev server, proxies /api and /_ to the backend
make debug                                  # both of the above together with LOG_LEVEL=debug
make seed                                   # sample data, see below
make test                                   # go vet + go test, typecheck, vitest
make e2e                                    # Playwright against the built binary, see CLAUDE.md
make build                                  # frontend into backend/ui/dist and the binary backend/intern
make image                                  # build the Docker image
```

Passkeys only work at `http://localhost:5173`: WebAuthn does not accept an IP address such as `127.0.0.1`.
Production needs no configuration; other sites set `PASSKEY_RP_ID` and `PASSKEY_ORIGIN` (comma separated).

`make seed` fills `backend/pb_data` with sample data. Log in as `keine@`, `verwendung@`, `pruefung@` or
`verwaltung@ffneumarkt.local` with the password `intern-dev-1234`, one user per permission level. The last one
is also an admin in every area.

## Administration

Members, their permissions, categories, the transport document settings and corrections of uses and checks are
managed in the app under Einstellungen → Verwaltung. What a user may do there is a set of admin areas
(`members`, `categories`, `transport`, `corrections`). The first admin and the default setup (categories, check types, locations) come from one command:

```sh
intern bootstrap --admin-email EMAIL --admin-name NAME             # idempotent; see deploy/README.md for a whole staging setup
intern admin grant EMAIL members categories transport corrections   # also: admin revoke, admin list
```

A new member gets a one-time setup link from an admin and sets the first password on `/einrichtung`.
PocketBase's dashboard and admin API (`/_/`, superuser login, settings, backups) answer 404 unless the request
comes from the machine itself; `ADMIN_API_ALLOW=true` opens them on purpose. Deployment: `deploy/README.md`.

The backend logs with `charmbracelet/log`; set `LOG_LEVEL` (`debug`, `info`, `warn`, `error`; default `info`).

## License

MIT, see `LICENSE`.
