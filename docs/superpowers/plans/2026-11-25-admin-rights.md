# Admin rights (PR 1 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-area admin rights stored in the database, enforced by collection rules and hooks, and grantable from a CLI, so the PocketBase dashboard is no longer needed for members, permissions, categories or transport settings.

**Architecture:** A new `admin_rights` collection (user, area). A migration adds it and widens the rules of `users`, `permissions`, `categories` and `transport_document_settings` with a `holds(area)` rule fragment in the style of `perm()`. A new package `internal/admin` holds the area names, hooks (last-holder guard, category delete only when empty, member emails visible to `members` holders) and the grant/revoke/list functions behind `intern admin`.

**Tech Stack:** Go, PocketBase (collection rules, hooks, cobra commands), `internal/testenv`.

**Spec:** `docs/superpowers/specs/2026-11-25-admin-ui-design.md`. This plan is PR 1 of 3. PR 2 (setup links, new-member routes) and PR 3 (screens, corrections) get their own plans. `setup_links` and `corrections` collections are created by the PRs that use them, not here (the spec says one migration; this is the one deviation, the spec is updated in Task 5).

## Global Constraints

- Areas, verbatim: `members`, `categories`, `transport`, `corrections`.
- `admin_rights`: unique on (user, area); a user reads their own rows; `members` holders read all and create/delete; no update rule.
- `uses` and `checks` rules stay closed.
- Never deletable: the last `members` row; never deactivatable: the last active `members` holder.
- Category delete only without items.
- Go logging only through `charmbracelet/log` via `internal/logging`; no `log` or `fmt.Print` for diagnostics (CLI output for the user goes to `cmd.OutOrStdout()`).
- Tests that use `internal/testenv` live in external `_test` packages. TDD: failing test first, watch it fail.
- Work on a branch `feature/admin-rights` from `main`, PR against `main`.

## Review Focus

- A deactivated `members` holder's old token must not work for admin writes (the existing token key refresh covers it; Task 2 pins it).
- A `members` holder must not set another user's `password`, `verified`, `tokenKey` through PATCH (only `name`, `email`, `deactivated`). Task 2.
- Granting the same (user, area) twice returns 400, not 500. Task 1.
- A `categories` holder who has no `permissions` row for a category sees the category but none of its items. Task 2.
- Deleting an empty category that still has `permissions` or `check_types` rows gives a clear error or succeeds cleanly, never a 500. Task 3.

---

### Task 1: Areas and the `admin_rights` collection

**Files:**
- Create: `backend/internal/admin/areas.go`, `backend/internal/admin/doc.go`
- Create: `backend/migrations/1793380010_admin_rights.go`
- Modify: `backend/internal/testenv/testenv.go` (add helper)
- Test: `backend/migrations/admin_rights_test.go`

**Interfaces:**
- Produces: `admin.Members, admin.Categories, admin.Transport, admin.Corrections` (string constants), `admin.Areas []string` (the four, in that order), `admin.Valid(area string) bool`; migration helper `holds(area string) string` in package `migrations` (rule fragment); `testenv.Admin(t testing.TB, app core.App, user *core.Record, areas ...string) *core.Record` which creates one `admin_rights` row per area and returns the user.

- [ ] **Step 1: Write the failing tests** in `admin_rights_test.go` (package `migrations_test`, using `newRulesEnv`/`e.run` from `rules_test.go`). Create users `holder` (`testenv.Admin(..., admin.Members)`) and `other` (`testenv.Admin(..., admin.Categories)`). Tests:
  - `TestAdminRightsRules`: holder lists all rows (`"totalItems":2`); other lists only own row (`"totalItems":1`); a plain user `w.Use` lists none (`"totalItems":0`); holder POSTs `{"user":<w.Use.Id>,"area":"transport"}` → 200; `other` POSTs the same → 400/403 (assert the status the rule gives: 400 for a rule-failed create); holder DELETEs that row → 204; nobody PATCHes (holder PATCH → 403); anonymous lists none.
  - `TestAdminRightsRejectBadInput`: unknown area `"nope"` → 400; duplicate (user, area) → 400.
  - `TestAreas`: `admin.Valid("members")` true, `admin.Valid("x")` false, `len(admin.Areas) == 4`.
- [ ] **Step 2: Run** `cd backend && go test ./migrations ./internal/admin -run 'AdminRights|Areas' -v`. Expected: FAIL (collection/package missing).
- [ ] **Step 3: Implement** `areas.go` (constants, `Areas`, `Valid`), `doc.go` (package comment, as the other packages have), and the migration `addAdminRights`/`removeAdminRights` in `1793380010_admin_rights.go`: collection `admin_rights` with a required `user` relation to `users` (max 1, required, no cascade delete), a required `area` select with the four values (`MaxSelect: 1`), a `created()` field like other migrations, unique index on `(user, area)`, and rules: list/view `user = @request.auth.id || holds("members")`, create/delete `holds("members")`, update nil. Add `holds(area string) string` returning `(@collection.admin_rights.user ?= @request.auth.id && @collection.admin_rights.area ?= "<area>")`. `removeAdminRights` deletes the collection. Add `testenv.Admin` to `testenv.go`.
- [ ] **Step 4: Run** the same command. Expected: PASS. Also `go test ./migrations` fully (the collections list test in `collections_test.go` may need `admin_rights` added to its expected list; add it).
- [ ] **Step 5: Commit** `git add backend && git commit -m "add the admin_rights collection and its areas"`.

### Task 2: Rules for users, permissions, categories and transport settings

**Files:**
- Modify: `backend/migrations/1793380010_admin_rights.go` (extend `addAdminRights`/`removeAdminRights`)
- Test: `backend/migrations/admin_rules_test.go`

**Interfaces:**
- Consumes: `holds(area)`, `testenv.Admin`, `admin.*` from Task 1; `setRules(app core.App) error` from `1793380001_rules.go`.
- Produces: the widened rules; `removeAdminRights` restores the earlier rules by deleting `admin_rights` last and calling `setRules(app)` first (check that no later migration changed the rules of these four collections; if one did, restore those too).

- [ ] **Step 1: Write the failing tests** (package `migrations_test`), users: `members` holder `M`, `categories` holder `C`, `transport` holder `T`, plain `w.Use`:
  - `TestMembersRules`: `M` lists `users` (`"totalItems"` > 1) and sees `use@example.com`; `w.Use` lists none and does not see any email; `M` PATCHes another user's `name` and `deactivated:true` → 200; `M` PATCHes another user's `password` → 400/404 (assert the rule's status), also `verified` and `tokenKey`; `M` creates a user with email, name, password → 200; `C` and `T` creating a user → 403; `M` creates, updates and deletes a `permissions` row for any user and category (200, 200, 204); `C` creating a permission → 400/403; a deactivated `M`'s old token PATCHing a user → 401 or 404 (assert the status observed; this pins the token refresh).
  - `TestCategoriesRules`: `C` creates and updates a category (200/200) and lists all categories (`"totalItems":2`) even without permissions; `C` lists `items` → `"totalItems":0` (no leak); `M` creating a category → 403; plain user creating → 403 (as today).
  - `TestTransportRules`: `T` PATCHes the single `transport_document_settings` record → 200; `C` PATCH → 403/404; anyone, anonymous included, still reads it → 200.
  - Existing `TestUserRules` and the other rules tests still pass unchanged.
- [ ] **Step 2: Run** `cd backend && go test ./migrations -run 'MembersRules|CategoriesRules|TransportRules' -v`. Expected: FAIL.
- [ ] **Step 3: Implement** in the migration, after creating `admin_rights`, `users`: ListRule `holds(members)`; UpdateRule `(id = @request.auth.id && @request.body.deactivated:changed = false) || (holds(members) && @request.body.password:isset = false && @request.body.verified:isset = false && @request.body.tokenKey:isset = false)`; CreateRule `holds(members)`; DeleteRule stays nil (members are deactivated, not deleted); ViewRule stays `@request.auth.id != ""`. `permissions`: list/view `user = @request.auth.id || holds(members)`; create/update/delete `holds(members)`. `categories`: list/view add `|| holds(categories)` to the existing `canSee("id")` rule (reuse `anyLevel("id")` from `1793380001_rules.go`); create/update/delete `holds(categories)`. `transport_document_settings`: update `holds(transport)`, create and delete stay nil. Fetch each collection with `FindCollectionByNameOrId` and `app.Save`. `removeAdminRights` calls `setRules(app)` then deletes `admin_rights`.
- [ ] **Step 4: Run** `go test ./migrations -v`. Expected: PASS, including the old rules tests.
- [ ] **Step 5: Commit** `git commit -am "let admin rights widen the rules of users, permissions, categories and transport settings"`.

### Task 3: Hooks in `internal/admin`

**Files:**
- Create: `backend/internal/admin/hooks.go`
- Modify: `backend/internal/testenv/testenv.go` (`New` also calls `admin.Register(app)`), `backend/cmd/intern/main.go` (call `admin.Register(app)` next to `material.Register(app)`)
- Test: `backend/internal/admin/hooks_test.go` (package `admin_test`)

**Interfaces:**
- Consumes: `admin.Members`, `admin.Categories`, `testenv.Admin` from Task 1.
- Produces: `admin.Register(app core.App)` binding: `OnRecordDelete("admin_rights")` last-holder guard; `OnRecordUpdate("users")` refusing to deactivate the last active `members` holder; `OnRecordDelete("categories")` refusing a category that has items; `OnRecordEnrich("users")` calling `e.Record.IgnoreEmailVisibility(true)` for a request whose auth record holds `members` (so the Mitglieder list shows emails). Errors are `validation.Errors` like `guardLocationDelete` in `internal/material/hooks.go`.

- [ ] **Step 1: Write the failing tests** (`app := testenv.New(t)`, `testenv.Seed`, direct `app.Delete`/`app.Save` for guards; the API harness for the email test):
  - `TestLastMembersHolderStays`: one `members` holder → deleting its row fails; with a second holder the first row deletes; deleting a non-`members` row always works.
  - `TestLastActiveMembersHolderCannotBeDeactivated`: sole holder `deactivated=true` save fails; with a second active holder it works; a second holder that is itself deactivated does not count, so the first still cannot be deactivated.
  - `TestCategoryWithItemsCannotBeDeleted`: `w.CategoryA` (has `ItemA`) delete fails with the field error; a fresh empty category deletes; an empty category that has a `permissions` row and a `check_types` row deletes cleanly (no 500; assert success or the clear error, whichever the implementation chooses, and keep the implementation consistent: delete succeeds).
  - `TestMembersHolderSeesEmails`: API list of `users` as a `members` holder contains `use@example.com`; a `GET` of a user as a plain user still lacks the email (existing assertion in `TestUserRules`).
- [ ] **Step 2: Run** `cd backend && go test ./internal/admin -v`. Expected: FAIL.
- [ ] **Step 3: Implement** the four hooks and `Register`. Count remaining holders with `CountRecords("admin_rights", ...)` joined to `users` where `deactivated = false` (a `dbx` expression on the relation, or load the rows and the users); the guard sits before `e.Next()`. The category hook counts `items` with `category = id`; for the delete of an empty category that still has `permissions` / `check_types` rows, rely on PocketBase's relation cascade settings and, if a relation blocks the delete, delete those rows in the same transaction inside the hook.
- [ ] **Step 4: Run** `go test ./... ` in `backend/`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "guard the last members holder and non-empty categories, show emails to members holders"`.

### Task 4: `intern admin` CLI

**Files:**
- Create: `backend/internal/admin/grants.go`, `backend/cmd/intern/admin.go`
- Modify: `backend/cmd/intern/main.go` (`app.RootCmd.AddCommand(adminCommand(app))`)
- Test: `backend/internal/admin/grants_test.go` (package `admin_test`), `backend/cmd/intern/admin_test.go`

**Interfaces:**
- Consumes: `admin.Areas`, `admin.Valid`, `admin.Register`.
- Produces: `admin.Grant(app core.App, email string, areas ...string) error` (unknown email, unknown area, no areas → error; already held areas are skipped, not an error); `admin.Revoke(app core.App, email string, areas ...string) error` (goes through `app.Delete`, so the Task 3 guard applies; areas not held are skipped); `admin.List(app core.App) ([]admin.Holder, error)` with `type Holder struct { Email string; Areas []string }`, sorted by email, areas in `admin.Areas` order. Command `adminCommand(app core.App) *cobra.Command` with subcommands `grant EMAIL AREA...`, `revoke EMAIL AREA...`, `list`; output via `cmd.OutOrStdout()`.

- [ ] **Step 1: Write the failing tests:** `Grant` creates rows and a second call is a no-op; unknown email, unknown area and zero areas return errors and create nothing; `Revoke` removes rows and fails on the last `members` holder with the guard's message; `List` returns holders sorted. For the command: execute `adminCommand(app)` with args `grant a@b.c members` against a test app (`SetArgs`, `SetOut`) and assert the output line; `list` prints `email: area, area`; an unknown email returns an error.
- [ ] **Step 2: Run** `go test ./internal/admin ./cmd/intern -v`. Expected: FAIL.
- [ ] **Step 3: Implement** `grants.go` and the command; look the user up with `FindAuthRecordByEmail("users", email)`.
- [ ] **Step 4: Run** `go test ./...` and `go vet ./...`. Expected: PASS. Then run it for real against a throwaway data dir: `go run ./cmd/intern superuser upsert t@example.com pw12345678 --dir /tmp/x`, seed or create a user, then `go run ./cmd/intern admin grant <email> members --dir /tmp/x` and `admin list --dir /tmp/x` (use the scratchpad directory, not `/tmp`).
- [ ] **Step 5: Commit** `git commit -am "add intern admin grant, revoke and list"`.

### Task 5: Dev seed, docs, scans

**Files:**
- Modify: `backend/internal/devseed/devseed.go` (+ its test), `CLAUDE.md`, `README.md`, `deploy/README.md`, `docs/superpowers/specs/2026-10-29-intern-platform-design.md` (§4, §10), `docs/superpowers/specs/2026-11-25-admin-ui-design.md` (the `setup_links`/`corrections` collections come with PR 2/3), `docs/superpowers/STATUS.md`

- [ ] **Step 1: Write the failing test** in `devseed_test.go`: after `Seed`, `admin.List` returns `verwaltung@ffneumarkt.local` with all four areas.
- [ ] **Step 2: Run** `go test ./internal/devseed -v`. Expected: FAIL.
- [ ] **Step 3: Implement** the grant in the seeder (the `verwaltung` user gets all areas through `admin.Grant`).
- [ ] **Step 4: Docs.** `deploy/README.md`: replace "create the first superuser … then add the users in `/_/`" with the bootstrap `intern admin grant <email> members categories transport corrections`, noting users are still created in `/_/` until PR 2 ships. `CLAUDE.md`/`README.md`: add the `admin` command to the commands, keep the `/_/` mention until PR 3. Spec §4: replace the "no admin screens and no admin flag" sentence with a pointer to the admin UI spec; §10: note the bootstrap. `STATUS.md`: a short entry for PR 1.
- [ ] **Step 5: Verify** `make test` (go vet, go test, tsc, vitest); `govulncheck ./...` in `backend/`; `npm audit` in `web/`.
- [ ] **Step 6: Commit and PR** `git commit -am "seed an admin, document the admin rights"`; push `feature/admin-rights`; open a PR against `main` (it changes rules and auth, so ask before enabling automerge: open it as a draft or with `no-automerge`).
