# Admin UI: administration inside the app

Date: 2026-11-25. Extends `2026-10-29-intern-platform-design.md`; replaces its statements that the admin works
in the PocketBase admin UI (`/_/`) and that the app has no admin screens or admin flag (§4, §10).

## Goal

Everything an admin does in `/_/` today is possible in the app, so `/_/` need not be reachable from the internet
on the VPS. Rights are granular per admin area and part of the existing permission model.

Outside this work: PocketBase's own settings (SMTP, backups, rate limits) and the first superuser stay on the
CLI or an SSH tunnel. The dashboard stays in the binary; it is blocked at the tunnel or proxy, not removed.

## Decisions

- Admin rights are rows in a new collection, not a flag on `users` and not a superuser login in the app.
- Areas: `members` (members and their permissions, and granting admin areas), `categories`, `transport`
  (`transport_document_settings`), `corrections` (uses and checks).
- Enforcement by PocketBase collection rules where rules can express it; Go routes under `/api/admin/*` and
  `/api/setup/*` for the rest. History (`uses`, `checks`) stays immutable through the collection API.
- A new member gets access by a one-time setup link the admin passes on (no SMTP in the project).
- The first admin is created by a CLI command. `members` is effectively the top right (its holder can grant
  anything); the UI says so.

## Data model and rules

New collections, each created by the PR that uses it (`admin_rights` and `admin_audit` in PR 1, `setup_links`
in PR 2, `corrections` in PR 3), in the style of `1793380001_rules.go`:

| Collection | Fields | Rules |
|---|---|---|
| `admin_rights` | user → users, area (`members` \| `categories` \| `transport` \| `corrections`) | unique on (user, area); a user reads their own rows, `members` holders read all and create or delete; no update |
| `setup_links` | user → users, token_hash, expires, used | no API rules; only the Go routes |
| `admin_audit` | admin → users, action, collection, record id, summary (JSON), created | read for `members` holders; written only by hooks and routes; one row for every change to `admin_rights`, `permissions`, members and categories made through the API |
| `corrections` | admin → users, action (`edit` \| `delete`), collection, record id, before (JSON), after (JSON), created | read for `corrections` holders; written only by the Go route |

Changed rules:

- `users`: the collection rules stay as they are (own record only, no create, no delete). Members are created
  and edited only through the Go routes below, which accept `name`, `email` and `deactivated` and nothing else
  (a rule cannot whitelist fields; a blacklist would miss `emailVisibility`, `passwordConfirm` and the like).
- `permissions`: create, update, delete for `members` holders; read as today.
- `categories`: write for `categories` holders; delete only without items (hook).
- `transport_document_settings`: write for `transport` holders; read stays public.
- `uses`, `checks`: rules unchanged (closed).

Last-holder guard (hook): the last `members` row cannot be deleted and the last active `members` holder cannot
be deactivated.

## Backend

Package `internal/admin`, registered next to `internal/material`. Every route needs a logged-in, non-deactivated
user and checks its area in Go.

- `GET /api/admin/members` (`members`): the member list with emails (PocketBase hides them from other users).
- `POST /api/admin/members` (`members`): name, email; creates the user with an unusable random password and
  returns a setup link once.
- `PATCH /api/admin/members/:id` (`members`): `name`, `email`, `deactivated` only.
- `POST /api/admin/members/:id/setup-link` (`members`): new link (new member or forgotten password); replaces
  an open link. Refused for a member who holds an admin right while active, so a `members` holder cannot take
  over another admin's account; deactivate first.
- `POST /api/setup/check` and `POST /api/setup/complete` (public): the token travels in the request body, never
  in a path or query. `check` says whether it is valid and returns the member's name; `complete` sets the
  password and marks the link used. Used, expired and unknown links give the same error. Rate-limited per IP
  and per link.
- `PATCH`/`DELETE /api/admin/uses/:id` and `/api/admin/checks/:id` (`corrections`): `PATCH` takes only the
  editable fields (use: date, kind, recorded name, note; check: date, result, note). Writes the `corrections`
  row in the same transaction and re-runs the status hooks. `DELETE` is refused when it would remove the only
  check that justifies the item's current status.

Setup links: 32 random bytes, base64url, only the SHA-256 hash is stored (compared in constant time), valid 24
hours, single use. The link is `/einrichtung#<token>`: the fragment is not sent to servers, proxies or logs, and
the page posts it in the body. Responses carry `Referrer-Policy: no-referrer`. After choosing the password the
member is offered a passkey through the existing flow.

Admin API shield: PocketBase's superuser login and schema routes live under `/api`, not only under `/_/`, and
the superuser login is what guards the database. A middleware answers 404 to `/_/`,
`/api/collections/_superusers/*`, `/api/settings*`, `/api/backups*`, `/api/logs*`, `/api/crons*` and the
collection schema routes (`/api/collections`, `/api/collections/{name}` without a further segment,
`/api/collections/{name}/truncate`, `/api/collections/import`, `/api/collections/meta/*`) unless the request is
from a loopback address and carries no forwarding header (`X-Forwarded-For`, `Forwarded`, `Cf-Connecting-Ip`),
or the environment sets `ADMIN_API_ALLOW=true`. Blocking at the tunnel is an additional layer, not the only one.

CLI: `intern admin grant EMAIL AREA...`, `intern admin revoke EMAIL AREA...`, `intern admin list`. Unknown
users are refused. Logging through `internal/logging`; user id and action only, never passwords or tokens.

## Screens (German, routes in `web/src/routes.ts`)

Entry: „Verwaltung“ in Einstellungen, only for users with at least one right. Screens live under `/verwaltung`
and check their own right („Keine Berechtigung.“ otherwise).

- Übersicht: one row per held area.
- Mitglieder: list (name, email, „Deaktiviert“ chip); add form (name, email) that shows the setup link once
  with „Link kopieren“ and the share sheet; detail with name, email, „Neuer Einrichtungslink“, deactivate or
  activate, level per category (Keine, Verwendung, Prüfung, Verwaltung) and admin areas as toggles; the
  last-holder error is shown as a message.
- Kategorien: list, form (name, maximum service life), delete only when empty (otherwise a hint).
- Beförderungspapier-Einstellungen: one form with all fields.
- Korrekturen: „Bearbeiten“ and „Löschen“ on history rows of the item page for `corrections` holders; delete
  asks through `useDialogs`; corrections show as „Korrigiert von … am …“ below the history.
- `/einrichtung` (public, outside the tab bar; the token is in the URL fragment): name, new password, then the passkey offer; an invalid
  link shows one neutral message.

Conventions: `Field` with `required`, `error` and the `tried` flag, shared `ui.tsx` pieces, `useResource`, no
`<Navigate>` in pages. API in `web/src/api/admin.ts`, fake in `web/src/test/fakeAdmin.ts`.

## Testing

TDD. Go: the admin API shield (blocked paths, allowed app paths, loopback, forwarding headers, the override), audit rows,
rules tests per collection and area (right holder, other area, plain member, anonymous), last-holder
guard, category delete, setup link (valid, expired, used, unknown, replaced, rate limit), corrections (edit,
delete, audit row, status hooks, refused delete), CLI. Tests using `internal/testenv` are in external `_test`
packages. Web: vitest per screen, rights gating, one-time link display, setup page and error states. E2E
(three browsers): admin creates a member, the member sets a password through the link and logs in, the admin
corrects a use; passkey after setup stays out of e2e. `make test`, `govulncheck`, `npm audit`.

## Rollout

1. Deploy with the migration; `/_/` is still reachable.
2. `intern admin grant <email> members categories transport corrections` on the VPS.
3. Check each area in the app. The shield already answers 404 for `/_/` and the admin API from the internet;
   also block them at the tunnel or proxy.
4. The superuser stays for PocketBase settings and backups (SSH tunnel or local).

Docs to update with the implementation: spec §4 and §10, `CLAUDE.md`, `README.md`, `deploy/README.md`,
`STATUS.md`.

## Delivery

Three PRs: (1) rights, rules, guards, audit, admin API shield, CLI and tests; (2) setup links and the new-member flow; (3) screens and
corrections.

## Not in scope

Email sending, deleting members (they stay deactivated), correcting anything but uses and checks, an audit
viewer beyond the „Korrigiert von“ lines.
