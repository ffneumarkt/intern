# Data and Auth (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the UI sketch with the real material tool: all collections and rules, password login, due dates computed once on the server, and every screen reading and writing real data.

**Architecture:** Go migrations define the schema and the rules; a rule-string helper keeps the permission check in one place. `internal/due` stays pure; `internal/material` adds record hooks and `GET /api/material/due`, the single source of item lists in the frontend. The frontend talks to PocketBase through `web/src/api/`, and tests replace those modules with in-memory fakes.

**Tech Stack:** Go 1.27, PocketBase v0.40.6, `pocketbase` JS SDK 0.28.1, React 19, Ionic React 9, react-router 6, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-intern-platform-design.md` (sections 3, 4, 5 password part, 6, 8; section 9 only for manual code entry and suggestions).

## Execution record

**Status: done** on branch `feature/data-and-auth`. Executed inline. The task text below is the plan as
approved; these deviations apply and the code is authoritative:

- Member deactivation was added on user request before Task 1 (already in the text below).
- Forms use native inputs and selects through `components/Field.tsx` instead of `IonInput`/`IonSelect`,
  which get no props under jsdom. `setIonValue` was dropped.
- Logout lands on the login page, not Start: `RequireLogin` redirects first.
- After a partly saved item, Manage stays open with the form cleared and a warning.
- `ItemForm` gained `Notiz`, and `api/errors.ts` holds the errors screens explain.

## Global Constraints

- UI text German only; code, comments and identifiers English.
- Go logging only through `internal/logging` (`charmbracelet/log`); no `log`/`fmt.Print` for diagnostics.
- Routes are defined once in `web/src/routes.ts`.
- `web/src/sketch/` is deleted by the end of this plan, including `?ansicht=` and `ViewAsBar`.
- Frontend tests find Ionic components by visible text with `web/src/test/ionic.ts`; inputs are driven with `fireEvent`.
- Dates are calendar dates in Europe/Vienna. `CGO_ENABLED=0`.
- Each rule gets an API test. The admin is a PocketBase superuser; there are no admin screens.
- `make test` is the whole-task gate on any task touching both sides.

## Verified by spike (2026-10-30, against v0.40.6)

The spec's example rule is wrong and these facts are settled; do not re-derive them.

- `?~ "check|manage"` is a LIKE, not a regex. Use `(@collection.permissions.level ?= "check" || @collection.permissions.level ?= "manage")`.
- All `@collection.permissions.*` conditions in one rule match the **same row**: a user with `use` on A and `manage` on B cannot write to A.
- `@request.body.<field>:changed = false` works in update rules; a forbidden update returns 404, a forbidden create 400.
- PocketBase's default `users.createRule` is `""` (public registration) and `deleteRule` lets users delete themselves. Both must be closed.
- `tests.NewTestAppWithConfig(core.BaseAppConfig{DataDir: t.TempDir(), EncryptionEnv: "x"})` gives a fresh database with registered migrations applied.
- A self-referencing relation needs two saves: save the collection, then add the field with its own `Id`.
- `collection.AddIndex("idx_items_barcode", true, "barcode", "barcode != ''")` allows many empty barcodes and rejects duplicates.
- Date-only input `2016-03-01` is stored as `2016-03-01 00:00:00.000Z`: take the UTC date part with no conversion. Autodate fields are real instants and must be converted to Europe/Vienna.
- Transactional hook, rolling back the check when the item update fails:
  ```go
  app.OnRecordCreateExecute("checks").BindFunc(func(e *core.RecordEvent) error {
      orig := e.App
      err := orig.RunInTransaction(func(tx core.App) error {
          e.App = tx
          if err := e.Next(); err != nil { return err }
          // load and save the item through tx
      })
      e.App = orig
      return err
  })
  ```
- `users.viewRule = @request.auth.id != ""` makes `expand=performed_by` return names without emails.
- `useIonViewWillEnter` fires in jsdom on mount and on each entry; Ionic keeps left pages mounted, so an effect alone shows stale data.

## Decisions on what the spec leaves open

- Code suggestions stay as in the sketch: names and codes match, no cap (open question in `STATUS.md` closed by the user's sketch approval).
- `uses` and `checks` are immutable through the API (no update or delete rule); superusers correct them in `/_/`.
- Neither can be created on a retired item, otherwise a `defect` check would bring a retired item back.
- An item's `category` cannot change through the API. `status` can only change to `retired` by hand; `defective` and back come from checks.
- Controls that do nothing until later phases are removed rather than left inert: passkey login button, Settings notification, push and passkey sections, camera picker and torch. They return with phases 3, 4 and 5. The label page stays with its QR placeholder until phase 5. Unknown-code assignment keeps linking to Manage.
- Members are deactivated, not deleted (user decision 2026-10-30): the superuser sets `users.deactivated` in `/_/`. Login and token refresh fail, existing tokens stop working at once, and permissions and all history stay, so clearing the flag restores the account. Phase 3 passkey login and phase 4 notifications must honour it.
- Added beyond the sketch because the sketch has no way in: "Verwalten" on the category page, and item edit at `paths.itemEdit`.
- Month arithmetic clamps to month end (`08-31` + 6 months = `02-28`).

## Review Focus

1. A user with `use` on one category and `manage` on another must not be able to write into the first. Test: Task 3.
2. Starting the app with no network must not log the user out, and must show the offline notice, not an empty list. Test: Task 6, Task 7.
3. Dates at month ends, leap days, and an item created at 23:30 UTC (already the next day in Vienna). Test: Task 1, Task 4.
4. Saving a use for several items where one write fails: retrying must not create duplicates. Test: Task 8.
5. After saving, going back to a page Ionic kept mounted must show the new data. Test: Task 7, Task 8.

---

### Task 0: Branch housekeeping

**Files:** `Makefile`, `README.md`, `CLAUDE.md` (uncommitted `make debug` target, already verified), this plan.

- [ ] **Step 1: Point the branch at its own remote name and commit**

`feature/data-and-auth` exists, created from `origin/main`.

```bash
git branch --unset-upstream
git add Makefile README.md CLAUDE.md
git commit -m "add make debug to run backend and frontend together"
git add docs/superpowers/plans/2026-10-30-data-and-auth.md
git commit -m "add phase 2 plan"
```

### Task 1: `internal/due`

**Files:**
- Create: `backend/internal/due/due.go`, `backend/internal/due/due_test.go`
- Modify: `backend/internal/due/doc.go` only if the comment goes stale

**Interfaces:**
- Produces, all dates being `time.Time` at 00:00 UTC, zero value meaning unset:
  ```go
  type State string  // StateOverdue "overdue", StateDueToday "dueToday", StateDueSoon "dueSoon", StateOK "ok"
  type Kind string   // KindCheck "check", KindEndOfLife "endOfLife", KindDefect "defect"
  type CheckType struct { ID string; IntervalMonths int; AfterUse bool; AlsoSatisfies []string } // 0 = no interval
  type Check struct { CheckTypeID, Result string; Date time.Time } // Result "passed"|"defect"|"retired"
  type Item struct { Status string; Created, ManufacturedOn time.Time; ServiceLifeYears int }
  type Due struct { Kind Kind; CheckTypeID string; Date time.Time; State State }
  type Input struct { Item Item; CheckTypes []CheckType; Checks []Check; Uses []time.Time }
  type Result struct { State State; Dues []Due } // Dues sorted by date, earliest first
  func Compute(in Input, today time.Time) Result
  func ViennaDay(t time.Time) time.Time // calendar date of an instant in Europe/Vienna
  func Today() time.Time                // ViennaDay(time.Now())
  ```

- [ ] **Step 1: Write the failing table-driven `TestCompute`**

Use today = 2026-10-30. Cases (spec sections 6 and 11), each asserting dates and states:

| Case | Setup | Expected |
|---|---|---|
| interval only | interval 12, passed 2026-01-15 | due 2027-01-15, ok |
| after use | after_use, passed 2026-01-01, uses 02-01 and 03-01 | due 2026-02-01, overdue |
| use before check ignored | after_use, use 01-01, passed 02-01 | no due |
| same-day check counts after use | after_use, use and passed both 02-01 | no due |
| earlier of both | interval 1 + after_use, passed 01-01, use 01-15 | due 01-15 |
| no check | interval 12, created 2026-10-01, no checks | due 2026-10-01 |
| no check with use | after_use, created 10-01, use 10-20 | due 10-01 |
| also_satisfies | A interval 12, B `AlsoSatisfies: [A]`, passed B 2026-06-01 | A due 2027-06-01 |
| not transitive | C satisfies B, B satisfies A, passed C | A falls back to creation date |
| failed checks ignored | `defect` check newest, `passed` older | due counted from `passed` |
| end of life | manufactured 2016-03-01, 10 years | endOfLife 2026-03-01, overdue |
| defective | status defective, defect checks 09-01 and 10-01 | `KindDefect` due 2026-10-01, state overdue |
| defective without check | status defective, no checks, created 10-01 | `KindDefect` due 10-01 |
| retired | status retired, overdue data | empty dues, ok |
| no triggers apply | no check types, no EOL | empty dues, ok |

- [ ] **Step 2: Write the failing `TestStates` and `TestMonthEnds`**

States by `today` offset: -1 overdue, 0 dueToday, +14 dueSoon, +15 ok. Item state is the earliest due's state. Month ends: `08-31` + 6 months = `02-28`; 2024-02-29 + 1 service year = 2025-02-28.

- [ ] **Step 3: Write the failing `TestViennaDay`**

`2026-10-29T23:30:00Z` → 2026-10-30 (CET); `2026-07-15T22:30:00Z` → 2026-07-16 (CEST).

- [ ] **Step 4: Run to verify failure**

Run: `cd backend && go test ./internal/due/`
Expected: FAIL, undefined `Compute`.

- [ ] **Step 5: Implement `due.go`**

Import `_ "time/tzdata"` so the location loads in any image; load `Europe/Vienna` in a package var and panic if it fails. Add a due only when it has a date; a check type with a relevant check and no triggers firing yields none.

- [ ] **Step 6: Run to verify pass, then commit**

Run: `cd backend && go test ./internal/due/ && go vet ./internal/due/`
Expected: PASS.

```bash
git add backend/internal/due
git commit -m "compute due dates for an item"
```

### Task 2: Collections and test environment

**Files:**
- Create: `backend/migrations/1793380000_collections.go`, `backend/migrations/collections_test.go`
- Create: `backend/internal/testenv/testenv.go`

**Interfaces:**
- Produces:
  ```go
  // testenv imports migrations, so tests get the real schema. Tests that use it live in
  // external packages (migrations_test, material_test) to avoid an import cycle.
  func New(t testing.TB) *tests.TestApp // temp DataDir, cleaned up via t.Cleanup
  type World struct {
      CategoryA, CategoryB *core.Record
      None, Use, Check, Manage, Mixed *core.Record // Mixed: use on A, manage on B
      ItemA, ItemB *core.Record                    // active, in A and B
      CheckTypeA, CheckTypeB *core.Record          // interval 12 months
  }
  func Seed(t testing.TB, app core.App) *World     // Use/Check/Manage have that level on A only
  func Token(t testing.TB, user *core.Record) string
  ```

- [ ] **Step 1: Write the failing `TestCollections`**

In package `migrations_test`, using `testenv.New`: every spec section 3 collection exists; `permissions` and `notification_settings` reject a duplicate (user, category); two items with empty barcode save, two with barcode `X` do not; `passkeys.credential_id` and `push_subscriptions.endpoint` reject duplicates; `items.created` is set on save; deleting an item cascades to its `uses` and `checks`; deleting a check type referenced by a check fails.

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && go test ./migrations/`
Expected: FAIL, collection not found (first add `testenv` with `New`, `Token` and a `Seed` that fails on the missing collection).

- [ ] **Step 3: Implement the migration with `m.Register(up, down)`**

Fields as spec section 3, names as written there; `down` deletes in reverse order. Pinned details:
- `check_types.also_satisfies`: self relation, added in a second save, `MaxSelect` 99.
- `interval_months`, `max_service_life_years`: `NumberField{OnlyInt: true, Min: 0}`, optional, 0 means unset.
- `items.created`, `uses.created`, `checks.created`: `AutodateField{OnCreate: true}`.
- `items.status`, `permissions.level`, `uses.kind`, `checks.result`: required `SelectField`.
- Dates: `DateField`. `timings`, `checklist`: `JSONField`. `notification_log.reason`, `.timing`: text.
- `CascadeDelete: true` on `uses.item`, `checks.item`, `notification_log.item` and on every `user` and `category` relation of `permissions`, `notification_settings`, `push_subscriptions`, `passkeys`, `notification_log`. Not on `items.category`, `check_types.category`, `checks.check_type`, `uses.created_by`, `checks.performed_by`: the history blocks those deletes (remove a leaver's permissions instead).
- Unique index on `notification_log` over the six dedupe columns.
- `transport_document_settings`: `station_name`, `station_street`, `station_postal_code`, `station_town`, `cylinder_label`, `cylinder_litres_tenths`, `points_limit`, `filling_station_name`, `filling_station_street`, `filling_station_postal_code`, `filling_station_town`, `checklist`; all optional.
- `users` gains `deactivated`: `BoolField`, not hidden, default false.
- All rules stay nil here (superuser only); Task 3 sets them.

- [ ] **Step 4: Run to verify pass, then commit**

Run: `cd backend && go test ./migrations/`
Expected: PASS.

```bash
git add backend/migrations backend/internal/testenv
git commit -m "add collections for material, notifications and passkeys"
```

### Task 3: Rules

**Files:**
- Create: `backend/migrations/1793380001_rules.go`, `backend/migrations/rules_test.go`

**Interfaces:**
- Consumes: `testenv.New`, `Seed`, `Token`.

Rule table, with `perm(cat, levels...)` building the spike's `(@collection.permissions.user ?= @request.auth.id && @collection.permissions.category ?= <cat> && (<level ?= ... || ...>))`, and `all` = use, check, manage. `-` means nil.

| Collection | list, view | create | update | delete |
|---|---|---|---|---|
| `users` | list own, view `@request.auth.id != ""` | - | own + `@request.body.deactivated:changed = false` | - |
| `categories` | `perm("id", all)` | - | - | - |
| `permissions` | `user = @request.auth.id` | - | - | - |
| `check_types` | `perm("category", all)` | `perm("category", manage)` | same + category unchanged | `perm("category", manage)` |
| `items` | `perm("category", all)` | `perm("category", manage)` + `@request.body.status = "active"` | see below | `perm("category", manage)` |
| `uses` | `perm("item.category", all)` | same + `@request.body.created_by = @request.auth.id && item.status != "retired"` | - | - |
| `checks` | `perm("item.category", all)` | `perm("item.category", check, manage)` + `@request.body.performed_by = @request.auth.id && item.status != "retired" && check_type.category = item.category` | - | - |
| `notification_settings`, `push_subscriptions` | own | `@request.body.user = @request.auth.id` | own + user unchanged | own |
| `passkeys` | own | - | own, only `name` changes | own |
| `notification_log` | - | - | - | - |
| `transport_document_settings` | `""` | - | - | - |

`items` update: `@request.body.category:changed = false && (@request.body.status:changed = false || @request.body.status = "retired") && (perm("category", manage) || (perm("category", check) && @request.body.status = "retired" && <name, serial, barcode, manufactured_on, note all :changed = false>))`.

- [ ] **Step 1: Write the failing `TestRules`**

In package `migrations_test`. One `tests.ApiScenario` per line, using `World` and `Token`, with `ExpectedContent` where data must show:

- `users`: anonymous `POST` denied; a user cannot delete themselves; a user cannot set their own `deactivated`; viewing another user shows the name, never the email.
- `None`: lists of categories, items, check types, uses, checks are empty; viewing `ItemA` is 404.
- `Use`: sees `ItemA`, not `ItemB`; can create a use on `ItemA`; cannot create a check (the spec's shared account case); cannot update `ItemA`.
- `Use`: use with `created_by` set to another user denied.
- `Check`: creates a check on `ItemA`; `performed_by` of another user denied; check with `CheckTypeB` on `ItemA` denied; retires `ItemA`; retire-and-rename in one `PATCH` denied; cannot create an item.
- `Manage`: creates, renames and deletes items and check types in A; cannot move `ItemA` to B; cannot create an item with status `defective`; cannot set `ItemA` to `defective`.
- `Mixed`: creates an item in B, and is denied creating one in A, updating `ItemA`, creating a check on `ItemA` (Review Focus 1).
- Retired item: use and check creation denied for `Manage`.
- `uses`, `checks`: `PATCH` and `DELETE` denied for `Manage`.
- `permissions`, `categories`: writes denied for `Manage`; a user lists only their own permissions.
- `notification_settings`: `Use` creates their own, cannot create for `Check`, cannot read `Check`'s, cannot reassign theirs.
- `passkeys`: `POST` denied; rename allowed; changing `public_key` denied.
- `notification_log`: listing denied.
- `transport_document_settings`: anonymous list 200, anonymous `POST` denied.

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && go test ./migrations/ -run TestRules`
Expected: FAIL, nil rules answer 403 where 200 is expected.

- [ ] **Step 3: Implement the rules migration with `perm` per the table**

- [ ] **Step 4: Run to verify pass, then commit**

Run: `cd backend && go test ./migrations/`
Expected: PASS.

```bash
git add backend/migrations
git commit -m "add collection rules per permission level"
```

### Task 4: Hooks and the due route

**Files:**
- Create: `backend/internal/material/hooks.go`, `hooks_test.go`, `route.go`, `route_test.go`
- Modify: `backend/internal/testenv/testenv.go` (bind `material.Register` in `New`), `backend/cmd/intern/main.go`

**Interfaces:**
- Consumes: `due.Compute`, `due.ViennaDay`, `due.Today`, `testenv`.
- Produces:
  ```go
  func Register(app core.App)                                           // record hooks
  func RegisterRoutes(se *core.ServeEvent, today func() time.Time)      // GET /api/material/due
  ```
  Response, dates as `2006-01-02`, empty optionals omitted:
  ```json
  {"items": [{"id": "", "categoryId": "", "name": "", "serial": "", "barcode": "", "manufacturedOn": "",
    "status": "active", "note": "", "state": "overdue",
    "dues": [{"kind": "check", "checkTypeId": "", "date": "2026-10-21", "state": "overdue"}]}]}
  ```

`testenv` then imports `material`, so `material` tests go in package `material_test`.

- [ ] **Step 1: Write failing hook tests**

`TestStatusSideEffects`, table over (item status, result) → item status: active+passed→active, defective+passed→active, active+defect→defective, active+retired→retired. `TestStatusRollback`: save a check with an `OnRecordUpdate("items")` hook returning an error; the check must not exist afterwards. `TestCheckTypeValidation`: no trigger rejected (`interval 0`, `after_use` false); `also_satisfies` naming another category's type rejected on create and on update; same-category accepted.

`TestDeactivatedUser`, setting the flag with `app.Save` as the admin UI does: password login returns the same 400 as a wrong password; a token issued before deactivating fails `auth-refresh` with 401 and gets 401 from `/api/material/due`; the user's uses and checks are unchanged and an expand still shows their name; their `permissions` remain; after clearing the flag, login works and the due list shows the same items. An unrelated update of an active user keeps their token valid.

- [ ] **Step 2: Write failing route tests with `tests.ApiScenario`**

- Anonymous: 401.
- `Use`: items of A only, `CheckTypeA` due with correct date and state; no B.
- `?category=<A>`: only A. `?category=<B>` as `Use`: 403. Unknown id: 403.
- `Mixed`: A and B both.
- `None`: `{"items":[]}`, with `[]`, not `null`.
- Retired item: present, `"dues":[]`, state `ok`.
- Item whose `created` instant is `2026-10-29 23:30:00Z` with no check: due `2026-10-30` (Review Focus 3). Set the instant with a direct SQL update, since autodate fields fill themselves on save.
- Check type with `also_satisfies` and a category with `max_service_life_years` both reach `due.Compute`.

Inject `today` as fixed 2026-10-30 through `BeforeTestFunc`.

- [ ] **Step 3: Run to verify failure**

Run: `cd backend && go test ./internal/material/`
Expected: FAIL, undefined `Register`.

- [ ] **Step 4: Implement `Register`**

Status side effects per the spike's pattern. Deactivation: `OnRecordAuthRequest("users")` returns `e.BadRequestError("Failed to authenticate.", nil)` when the flag is set, which covers password login and refresh; `OnRecordUpdate("users")` calls `RefreshTokenKey()` when the flag changes to true. Check type validation in `OnRecordValidate("check_types")`, returning `validation.Errors`; the messages are English because the frontend shows its own text.

- [ ] **Step 5: Implement `RegisterRoutes`**

Route bound with `apis.RequireAuth()`. Load the user's `permissions`, then for the permitted categories their categories, check types, items, and the checks and uses of those items, one query per collection, grouped in memory. Date fields use `.Time()` directly; `created` goes through `due.ViennaDay`. Sort items by name.

- [ ] **Step 6: Wire `main.go`**

`material.Register(app)` after `pocketbase.New()`; `material.RegisterRoutes(se, due.Today)` before `RegisterFrontend`.

- [ ] **Step 7: Run to verify pass, then commit**

Run: `cd backend && go vet ./... && go test ./...`
Expected: PASS.

```bash
git add backend
git commit -m "add check status hooks and the due route"
```

### Task 5: Development seed

Without it the app is empty after the sketch goes.

**Files:**
- Create: `backend/internal/devseed/devseed.go`, `devseed_test.go`, `backend/cmd/seed/main.go`
- Modify: `Makefile` (`seed` target, `.PHONY`), `CLAUDE.md`, `README.md`

**Interfaces:**
- Produces: `func Seed(app core.App, today time.Time) error`, `var ErrAlreadySeeded error`, and `go run ./cmd/seed [dir]`, with `dir` defaulting to `pb_data`.

- [ ] **Step 1: Write failing `TestSeed`**

After `Seed` with today 2026-10-30, `due.Compute` through the route gives at least one item each in overdue, dueToday, dueSoon, ok; one item is `defective`, one `retired`. A second `Seed` returns `ErrAlreadySeeded` and adds nothing.

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && go test ./internal/devseed/`
Expected: FAIL, undefined `Seed`.

- [ ] **Step 3: Implement**

The sketch's data (`web/src/sketch/mockData.ts`), with initial `passed` checks dated relative to `today` so the states hold on any day. Users `keine@`, `verwendung@`, `pruefung@`, `verwaltung@ffneumarkt.local`, password `intern-dev-1234`, with those levels on both categories. `cmd/seed/main.go` opens the data dir with `core.NewBaseApp`, bootstraps, runs migrations, seeds, and logs through `internal/logging`. It is a separate binary, so the seed never ships in the image.

- [ ] **Step 4: Add `make seed` (`cd backend && go run ./cmd/seed`) and document it in `CLAUDE.md` and `README.md`**

- [ ] **Step 5: Run to verify pass, then commit**

Run: `cd backend && go test ./internal/devseed/ && go run ./cmd/seed <scratch dir> && go run ./cmd/seed <scratch dir>`
Expected: PASS, the first seed logs success, the second reports already seeded. Never seed the real `backend/pb_data` here.

```bash
git add backend Makefile CLAUDE.md README.md
git commit -m "add a development seed"
```

### Task 6: Session, login and logout

**Files:**
- Create: `web/src/api/client.ts`, `web/src/api/auth.ts`, `web/src/api/auth.test.ts`, `web/src/session.tsx`, `web/src/test/fakeAuth.ts`
- Modify: `web/package.json` (add `pocketbase@0.28.1`), `web/src/App.tsx`, `web/src/App.test.tsx`, `web/src/components/Page.tsx`, `web/src/pages/LoginPage.tsx`, `web/src/pages/SettingsPage.tsx`, `web/src/pages/StartPage.tsx`, `web/src/pages/ItemPage.tsx`, `web/src/pages/RecordUsePage.tsx`, `web/src/pages/pages.test.tsx`, `web/src/test/ionic.ts`
- Delete: `web/src/sketch/session.tsx`, `web/src/sketch/ViewAsBar.tsx`

**Interfaces:**
- Produces:
  ```ts
  // api/client.ts
  export const pb: PocketBase  // base URL '/', pb.autoCancellation(false), afterSend clears the auth store on 401
  // api/auth.ts
  export type Level = 'use' | 'check' | 'manage'
  export interface User { id: string; name: string; email: string }
  export function currentUser(): User | null
  export function onAuthChange(listener: () => void): () => void
  export function login(email: string, password: string): Promise<void>
  export function logout(): void
  export function refresh(): Promise<void>                  // keeps the session on a network error
  export function listLevels(): Promise<Record<string, Level>> // by category id
  // session.tsx
  export function SessionProvider({ children }): JSX.Element
  export function useSession(): {
    user: User | null
    can(categoryId: string, required: Level): boolean
    canAnywhere(required: Level): boolean
    login(email: string, password: string): Promise<void>
    logout(): void
  }
  // test/fakeAuth.ts: same exports as api/auth.ts, plus
  // null = logged out; level applies to every category unless levels names them per category.
  export function signInAs(level: Level | null, levels?: Record<string, Level>): void
  // test/ionic.ts: add
  export const setIonValue: (el: Element, value: string) => void // dispatches ionInput and ionChange
  ```

`vi.mock('../api/auth', () => import('../test/fakeAuth'))` in each frontend test file. Auto-cancellation stays off: the SDK would otherwise abort parallel requests to one collection.

- [ ] **Step 1: Write failing `api/auth.test.ts`**

Mock `fetch`. `refresh` with a 401 clears the store; `refresh` with a rejected fetch keeps it (Review Focus 2).

- [ ] **Step 2: Rewrite `App.test.tsx` and `pages.test.tsx` setup to the session**

Replace `localStorage.setItem('sketch.level', …)` by `signInAs(level)`. Delete the "view as switcher" and "sketch level from url" tests. `pages.test.tsx` keeps importing mock items through the unchanged sketch files for now, and `can` must therefore accept the sketch's category ids: the fake grants every id. Add:

- `App.test`: login with email and password opens the due list; the error shows `Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen.`; logout from Einstellungen returns to Start with no Material tab; the logged-out login page has no `Mit Passkey anmelden`.

- [ ] **Step 3: Run to verify failure**

Run: `cd web && npm test`
Expected: FAIL, cannot resolve `../api/auth`.

- [ ] **Step 4: Implement `client.ts`, `auth.ts`, `session.tsx`, `fakeAuth.ts`**

`SessionProvider` calls `refresh` then `listLevels` on start and after login, subscribes to `onAuthChange`, and treats a logged-in user with failed `listLevels` as having no levels. Only `use`+ routes check `user`, not levels.

- [ ] **Step 5: Replace sketch session use**

`atLeast(level, …)` becomes `session.user` for logged-in checks and `can(item.categoryId, …)` on items; `Gerät zuordnen` uses `canAnywhere('manage')`. Remove `ViewAsBar` from `Page`. `LoginPage`: real form with the error line, redirect to `paths.dueList` on success; passkey button gone. `SettingsPage`: name, email, `Abmelden` only.

- [ ] **Step 6: Run to verify pass, then commit**

Run: `make test`
Expected: PASS.

```bash
git add web
git commit -m "add password login and session"
```

### Task 7: Read screens on real data

**Files:**
- Create: `web/src/api/material.ts`, `web/src/api/material.test.ts`, `web/src/useResource.ts`, `web/src/components/Loaded.tsx`, `web/src/today.ts`, `web/src/today.test.ts`, `web/src/test/fixtures.ts`, `web/src/test/fakeMaterial.ts`
- Modify: `web/src/components/ItemRow.tsx`, `web/src/pages/DueListPage.tsx`, `CategoryPage.tsx`, `ItemPage.tsx`, `LabelPage.tsx`, `web/src/pages/pages.test.tsx`

**Interfaces:**
- Consumes: `pb`, `useSession`.
- Produces:
  ```ts
  // api/material.ts. Item, Due, Category, CheckType, HistoryEntry keep the sketch's shapes;
  // Due gains kind and checkTypeId. label is derived: the check type's name, 'Lebensdauer', 'Mangel'.
  export function listCategories(): Promise<Category[]>
  export function listCheckTypes(): Promise<CheckType[]>
  export function listItems(): Promise<Item[]>  // /api/material/due, the only source of item lists
  export function listHistory(itemId: string): Promise<HistoryEntry[]> // uses + checks, newest first
  // useResource.ts
  export function useResource<T>(load: () => Promise<T>): { data?: T; error?: unknown; reload(): void }
  // components/Loaded.tsx: renders the offline notice on error, nothing until data, else children(data)
  export default function Loaded<T>(props: { resource: Resource<T>; children: (data: T) => ReactNode }): JSX.Element
  // today.ts
  export function today(): string // yyyy-mm-dd in Europe/Vienna, via Intl
  ```

Filters use `pb.filter()` with parameters. `useResource` loads in `useIonViewWillEnter`, not in an effect (see spike). The fake material module serves `test/fixtures.ts`, the sketch's data moved over, as a mutable copy reset in `beforeEach`.

- [ ] **Step 1: Write failing `today.test.ts`**

Fake system time `2026-10-29T23:30:00Z` gives `2026-10-30`.

- [ ] **Step 2: Write failing `material.test.ts`**

Mock `fetch`: `listItems` maps `kind: 'endOfLife'` to label `Lebensdauer`, and a check due to its check type's name. `listHistory` orders uses and checks newest first; a use shows `recorded_by_name`, falling back to `expand.created_by.name`.

- [ ] **Step 3: Update `pages.test.tsx` to the fake and add failing tests**

Import from `test/fixtures` and mock `../api/material`. Existing assertions stay. Add:

- Due list shows `Keine Verbindung. Die Materialverwaltung braucht eine Internetverbindung.` when `listItems` rejects, and no group headings (Review Focus 2).
- Logged-in user with no categories sees `Noch keine Kategorie freigegeben.`
- `Verwalten` shows on the category page at `manage` only.
- Item page shows `Lebensdauer` and an item with no dues renders with no due line in `ItemRow`.
- A second visit reloads: item page, mutate the fixture, navigate away and back, the new value shows (Review Focus 5).

- [ ] **Step 4: Run to verify failure**

Run: `cd web && npm test`
Expected: FAIL, cannot resolve `../api/material`.

- [ ] **Step 5: Implement `today.ts`, `material.ts`, `useResource.ts`, `Loaded.tsx`, fixtures and fake**

- [ ] **Step 6: Move `DueListPage`, `CategoryPage`, `ItemPage`, `LabelPage`, `ItemRow` to `useResource`**

`ItemPage` finds its item in `listItems()`. Add `paths.manageCategory(id)` (`/material/verwalten?kategorie=<id>`) and `paths.itemEdit(id)` (`/material/geraete/<id>/bearbeiten`) to `routes.ts`, and the category page's `Verwalten` button.

- [ ] **Step 7: Run to verify pass, then commit**

Run: `make test`
Expected: PASS.

```bash
git add web
git commit -m "read material screens from the API"
```

### Task 8: Record use, record check, retire

**Files:**
- Modify: `web/src/api/material.ts`, `web/src/test/fakeMaterial.ts`, `web/src/pages/RecordUsePage.tsx`, `RecordCheckPage.tsx`, `ItemPage.tsx`, `web/src/pages/pages.test.tsx`

**Interfaces:**
- Consumes: `listItems`, `listCheckTypes`, `useResource`, `today`, `currentUser`.
- Produces:
  ```ts
  export interface UseInput { date: string; kind: 'operation' | 'exercise' | 'other'; recordedByName: string; note: string }
  export interface CheckInput { checkTypeId: string; date: string; result: 'passed' | 'defect' | 'retired'; note: string }
  export function recordUse(itemId: string, input: UseInput): Promise<void>     // created_by = current user
  export function recordCheck(itemId: string, input: CheckInput): Promise<void> // performed_by = current user
  export function retireItem(itemId: string): Promise<void>
  ```

- [ ] **Step 1: Write failing tests in `pages.test.tsx`**

- Record use saves one use per scanned item with the form's values, then returns to the due list.
- `Erfasst von` is prefilled on the next visit from `localStorage` key `intern.recordedBy`.
- Date defaults to `today()`.
- `recordUse` failing for the second of three items: `Speichern fehlgeschlagen.` shows, the form stays, the list holds only the unsaved two, and saving again writes each once (Review Focus 4).
- Scanning a retired item's exact code shows `Nicht gefunden`.
- Existing scan loop and suggestion tests keep passing, with the camera picker and torch removed.
- Record check saves the selected type, date, result and note; the types offered are only the item's category's; returns to the item page, which shows the new history entry (Review Focus 5).
- `Ausscheiden` with `window.confirm` accepted calls `retireItem`; dismissed does not.

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npm test -- src/pages/pages.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement API functions and pages**

`RecordUsePage` keeps its state and takes items from `listItems()`; `findByBarcode` and `searchItems` move into the page's module, operate on the loaded list, and both skip retired items. Save sequentially, removing each item from the list as it succeeds, so a retry only writes the rest. Use `window.confirm` for retire, with `<Name> ausscheiden?`.

- [ ] **Step 4: Run to verify pass, then commit**

Run: `make test`
Expected: PASS.

```bash
git add web
git commit -m "record uses and checks, retire items"
```

### Task 9: Manage items and check types

**Files:**
- Create: `web/src/components/ItemForm.tsx`, `web/src/pages/ItemEditPage.tsx`
- Modify: `web/src/api/material.ts`, `web/src/test/fakeMaterial.ts`, `web/src/pages/ManagePage.tsx`, `web/src/App.tsx`, `web/src/pages/ItemPage.tsx`, `web/src/pages/pages.test.tsx`

**Interfaces:**
- Consumes: `paths.manageCategory`, `paths.itemEdit`, `useSession().can`.
- Produces:
  ```ts
  export interface ItemInput { categoryId: string; name: string; serial: string; barcode: string; manufacturedOn: string; note: string }
  export interface CheckTypeInput { categoryId: string; name: string; intervalMonths: number; afterUse: boolean; alsoSatisfies: string[] }
  // lastChecked: check type id → date; each creates an initial passed check.
  export function createItem(input: ItemInput, lastChecked: Record<string, string>): Promise<Item['id']>
  export function updateItem(itemId: string, input: Omit<ItemInput, 'categoryId'>): Promise<void>
  export function deleteItem(itemId: string): Promise<void>
  export function createCheckType(input: CheckTypeInput): Promise<void>
  export function updateCheckType(id: string, input: Omit<CheckTypeInput, 'categoryId'>): Promise<void>
  export function deleteCheckType(id: string): Promise<void>
  ```

- [ ] **Step 1: Write failing tests in `pages.test.tsx`**

- Manage lists only categories at `manage`; `?kategorie=` preselects; a user with no `manage` sees `Keine Berechtigung.`
- Creating an item calls `createItem` with the fields and one `lastChecked` entry per filled date; check type dates come from the selected category, not all categories.
- Duplicate barcode (a rejection with `data.barcode`) shows `Code ist bereits vergeben.` and keeps the form.
- Item edit prefills, saves through `updateItem`, returns to the item page; `Bearbeiten` on the item page opens it.
- `Gerät löschen` with `window.confirm` accepted deletes and returns to the category.
- Creating a check type with neither interval nor after use shows `Intervall oder „nach Verwendung“ angeben.` and does not call the API.
- Check type form offers only same-category types for `gilt auch als`, excluding itself.
- Deleting a check type that the API refuses shows `Prüfart wird noch verwendet und kann nicht gelöscht werden.`

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npm test -- src/pages/pages.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`createItem` creates the item, then the initial checks in sequence with `performed_by` the current user and result `passed`. If a check fails the item exists: the form navigates to the item page and shows `Gerät angelegt, aber nicht alle Prüfungen gespeichert.`, because retrying would hit the unique barcode. Register `paths.itemEdit()` in `App.tsx`.

- [ ] **Step 4: Run to verify pass, then commit**

Run: `make test`
Expected: PASS.

```bash
git add web
git commit -m "manage items and check types"
```

### Task 10: Remove the sketch, verify for real, hand over

**Files:**
- Delete: `web/src/sketch/`
- Modify: `README.md`, `CLAUDE.md`, `docs/superpowers/STATUS.md`, `docs/superpowers/specs/2026-10-29-intern-platform-design.md`

- [ ] **Step 1: Delete the sketch and prove nothing uses it**

Run: `rm -rf web/src/sketch && grep -rn -E "sketch|ansicht|ViewAsBar" web/src README.md`
Expected: no matches. Fix any that remain, moving `mockData` leftovers to `test/fixtures.ts`.

- [ ] **Step 2: Run the full suite and the build**

Run: `make test && make build`
Expected: PASS, binary at `backend/intern`.

- [ ] **Step 3: Drive the real app in a browser**

On a scratch data dir, run `go run ./cmd/seed <dir>`, start `backend/intern serve --dir <dir>`, and use Playwright's Chromium (see `STATUS.md`). Log in as `verwendung@` and record a use, as `pruefung@` record a `defect` check and see the item move to `Mangel`, as `verwaltung@` create an item with a "last checked" date, as `keine@` see the empty notice. Stop the server and reload: the offline notice shows and the session survives. Screenshot each at 390 × 844.
Expected: each step behaves as stated.

- [ ] **Step 4: Update the docs**

`README.md` and `CLAUDE.md`: drop `?ansicht=`, describe login with seed users; `CLAUDE.md`: sketch convention removed. Spec: document `users.deactivated` in sections 3, 4 and 5 (and that passkey login and notifications must honour it), replace the `?~` example rule with the settled form, remove "deleted in phase 2" and the open suggestion question, state that `uses` and `checks` are immutable, and record `users.viewRule`. `STATUS.md`: Phase 2 done, next step Phase 3, open question closed, and add the plan's Execution record the way Phase 1's has one.

- [ ] **Step 5: Commit**

```bash
git add -A web README.md CLAUDE.md docs
git commit -m "remove the sketch and update docs for phase 2"
```
