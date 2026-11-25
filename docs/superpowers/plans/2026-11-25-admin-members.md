# Admin members and setup links (PR 2 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox syntax.

**Goal:** Members are created, edited, deactivated and given access through Go routes and one-time setup links, so the PocketBase dashboard is no longer needed for users; the member sets a first password on a public setup page.

**Architecture:** `internal/admin` gets `RegisterRoutes` (members routes behind the `members` right, public setup routes). Links are stored hashed in `setup_links`; the token travels in a request body, the page reads it from the URL fragment. The web gets one public page `/einrichtung`.

**Spec:** `docs/superpowers/specs/2026-11-25-admin-ui-design.md` (Backend, Setup links). Plan of PR 1: `2026-11-25-admin-rights.md`.

## Global Constraints

- Token: 32 random bytes, base64url, only the SHA-256 hash stored, compared in constant time, valid 24 hours, single use; used, expired, unknown and deactivated-member links answer alike.
- Token only in request bodies, never in a path or query; `Referrer-Policy: no-referrer` on `/api/setup/*` and on the `/einrichtung` page.
- `PATCH /api/admin/members/:id` accepts `name`, `email`, `deactivated` and nothing else (unknown fields are refused).
- A setup link is refused for a member who holds an admin right while active.
- New password: at least 10 characters. `/api/setup/` is rate-limited per IP (10 per 60 s).
- Every member change and link issue writes an `admin_audit` row; no token or password in logs or audit.
- UI text German only; tests using `internal/testenv` live in external `_test` packages; TDD.

## Review Focus

- A used or replaced link must not work; the old link dies when a new one is issued.
- A deactivated member can neither set a password through a link nor be given a link while holding an admin right.
- The `members` holder cannot change `password`, `verified`, `tokenKey` through `PATCH`.
- The setup page must not send the token anywhere except the body of the two setup requests.

### Task 1: `setup_links` and the rate limit (migration)
Files: `backend/migrations/1793380012_setup_links.go`, test `backend/migrations/setup_links_test.go`.
- [ ] Test: collection `setup_links` exists with fields user, token_hash (unique), expires, used and no API rules (a members holder listing it gets 403); settings contain a rule labelled `/api/setup/` with 10 requests per 60 s. Watch it fail.
- [ ] Migration `addSetupLinks` / `removeSetupLinks` (removes the collection and the rule).
- [ ] Commit.

### Task 2: Members routes
Files: `backend/internal/admin/members.go`, `backend/internal/admin/audit.go` (extract `Log(app, adminID, action, collection, record, summary)`), test `backend/internal/admin/members_test.go`.
Interfaces: `admin.RegisterRoutes(se *core.ServeEvent, logger *log.Logger)`; `GET /api/admin/members` → `[{id,name,email,deactivated,areas}]`; `POST /api/admin/members {name,email}` → `{id,token,expires}`; `PATCH /api/admin/members/{id}`; `POST /api/admin/members/{id}/setup-link` → `{token,expires}`.
- [ ] Tests (harness: `apis.NewRouter`, `BuildMux`, httptest): anonymous 401, plain user and other-area holders 403; list has email and areas; create returns a token, the user exists active, duplicate and invalid email 400, an audit row exists; patch changes name/email/deactivated, refuses `password` and unknown fields (400, nothing changed), refuses deactivating the last members holder; setup-link replaces the previous link, is refused (400) for an active admin-right holder and allowed once deactivated.
- [ ] Implement; wire `admin.RegisterRoutes` in `cmd/intern/main.go`; run `go test ./...`; commit.

### Task 3: Public setup routes
Files: `backend/internal/admin/setup.go`, test `backend/internal/admin/setup_test.go`.
Interfaces: `POST /api/setup/check {token}` → `{name}`; `POST /api/setup/complete {token,password}` → 204.
- [ ] Tests: valid token checks and completes, then the password logs in through `POST /api/collections/users/auth-with-password`; the same token afterwards is refused; wrong, expired (expires set in the past) and deactivated-member tokens give the identical error body; a password under 10 characters is refused and keeps the link usable; the stored `token_hash` is not the token; responses carry `Referrer-Policy: no-referrer`.
- [ ] Implement (constant-time compare, `SetPassword` refreshes the token key); commit.

### Task 4: Setup page in the web app
Files: `web/src/api/setup.ts`, `web/src/test/fakeSetup.ts`, `web/src/pages/SetupPage.tsx`, `web/src/routes.ts` (`setup: '/einrichtung'`), `web/src/App.tsx`, `web/src/pages/pages.test.tsx` (or a new `SetupPage.test.tsx`), `web/src/server/frontend` header in `backend/internal/server/frontend.go` for `/einrichtung`.
- [ ] Tests: the page reads the token from the URL fragment, shows the member's name, two password fields (equal, at least 10 characters, `required` rules as elsewhere), saves through `completeSetup`, then shows „Passwort gesetzt“ with a „Zur Anmeldung“ button; an invalid link shows one neutral message and no form; the token is never in a request URL (the fake records calls).
- [ ] Implement; Go test that `/einrichtung` carries `Referrer-Policy: no-referrer`; e2e spec (Chromium, Firefox, WebKit): admin creates a member through the API, the page sets a password, the member logs in.
- [ ] `make test`, `govulncheck`, `npm audit`; commit; PR.
