# FF Intern

Internal tools of FF Neumarkt at `intern.ffneumarkt.at`: Beförderungspapier (public, offline) and
material check intervals. Go + PocketBase backend with an embedded Ionic React frontend.

Design: `docs/superpowers/specs/2026-10-29-intern-platform-design.md`

## Development

```sh
go run . serve              # backend on http://127.0.0.1:8090, admin UI at /_/
npm --prefix web run dev    # frontend dev server, proxies /api and /_ to the backend
make image                  # build the Docker image
```
