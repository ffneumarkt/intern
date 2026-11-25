# FF Intern

Internal tools of FF Neumarkt at `intern.ffneumarkt.at`: Beförderungspapier (public, offline) and
material check intervals. Go + PocketBase backend with an embedded React frontend (Tailwind, shadcn-style components).

Design: `docs/superpowers/specs/2026-10-29-intern-platform-design.md` · Status and next steps: `docs/superpowers/STATUS.md`

## Get started

Pick what you need; every variable is explained in `deploy/env.example`.

**A new server (staging or production)** with Docker:

```sh
ADMIN_EMAIL=chef@example.com TUNNEL_TOKEN=... deploy/bootstrap-staging.sh
```

It writes `.env` with new push keys, runs the migrations, adds the default categories, check types and locations,
creates the first admin (password printed once) and starts the app; without `TUNNEL_TOKEN` the app listens on
`127.0.0.1:8090` instead of a Cloudflare tunnel. The manual steps, backup and restore are in `deploy/README.md`.

**On your machine** (Go and Node):

```sh
make seed      # sample data and users, password intern-dev-1234 (see Development)
make dev-api   # backend on :8090
make dev-web   # frontend on :5173, open http://localhost:5173
```

**What you get and what is still yours to do:** a fresh install has the workshop location and the Beförderungspapier
settings (migrations). The default categories, check types and the locations RLF and LAST come from
`intern bootstrap` or from `APPLY_DEFAULTS=true` on the first start. Members (each gets a one-time setup link),
their permissions per category and the items are added in the app under Einstellungen → Verwaltung.

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
