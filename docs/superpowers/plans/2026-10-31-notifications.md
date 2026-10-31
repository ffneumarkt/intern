# Notifications and Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 4: users get grouped Web Push reminders for due items, within a minute of a new due date, outside a quiet time they set themselves.

**Architecture:** A cron job runs every minute. `internal/notify` takes items and due dates from `internal/material`, decides per user what fires and hands one message per user to a `Sender`, implemented by `internal/push`. `notification_log` makes repeated runs harmless, so the job needs no state, timer or catch-up. The frontend adds a Settings section, a small service worker script and a filter on the due list.

**Tech Stack:** Go 1.27, PocketBase v0.40.6, `github.com/SherClockHolmes/webpush-go` v1.4.0, React 19, Ionic React 9, `vite-plugin-pwa` (`generateSW`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-intern-platform-design.md`, mainly §7, plus the rows for phase 4 in §3 and §8.

## Global Constraints

- Everything in `CLAUDE.md`: TDD, German UI, English code, `charmbracelet/log` via `internal/logging`, `Field.tsx` for inputs, `useResource` for loading, tests that use `internal/testenv` in external `_test` packages.
- All clock times and calendar days are Europe/Vienna. Calendar dates are `time.Time` at 00:00 UTC, as in `internal/due`.
- Reminders from timings and weekly overdue start at 07:00. The default quiet time is 22:00 to 07:00.
- Timings are whole numbers from 0 to 14, without repeats. New settings rows default to `[14, 3, 0]` with `weekly_overdue` on.
- At most 50 item ids in a push link. Test push: 5 per minute.
- Log timing values: `"0"`, `"14"`, … and `"overdue"`. Reasons: `check:<id>`, `end_of_life`, `defect`.
- `notification_log` is the job's only state.

## Review Focus

1. An item is checked during the user's quiet time: when quiet time ends, nothing is sent for it. (Task 4)
2. An admin creates a `notification_settings` row in `/_/` with empty or null `timings`: no crash, nothing fires for it, other rows still work. (Task 3)
3. One user's delivery fails or errors: the other users in the run still get theirs, and the failed user is retried next minute. (Task 4)
4. A run at 23:30 UTC is already the next day in Vienna: "today" and quiet time both use Vienna, in summer and winter time. (Task 4)
5. A push link is opened after all its items were dealt with: the due list says so instead of showing an empty page. (Task 8)

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/migrations/1793380006_notification_preferences.go` | New collection, its rules, the test push rate limit |
| `backend/internal/material/hooks.go` | Validation of timings, quiet times and subscription endpoints |
| `backend/internal/material/load.go` | New: `PermittedCategories`, `LoadDues`, shared by the route and notify |
| `backend/internal/notify/fire.go` | Pure rules: what fires, quiet time |
| `backend/internal/notify/message.go` | Pure: fired items → German message and link |
| `backend/internal/notify/job.go` | Loads data per user, sends, writes the log, schedules the cron job |
| `backend/internal/push/sender.go` | `Sender` with Web Push, removes dead subscriptions |
| `backend/internal/push/routes.go` | `/api/push/key`, `/subscribe`, `/test` |
| `backend/cmd/intern/main.go` | Wiring, `intern vapid` |
| `web/src/api/notifications.ts`, `web/src/api/push.ts` | Settings records; browser subscription and push routes |
| `web/src/test/fakeNotifications.ts`, `web/src/test/fakePush.ts` | Test fakes |
| `web/src/components/NotificationSettings.tsx` | Settings section |
| `web/public/push-sw.js` | `push` and `notificationclick` handlers |

---

### Task 1: Schema, validation, rate limit

**Files:**
- Create: `backend/migrations/1793380006_notification_preferences.go`
- Modify: `backend/internal/material/hooks.go`, `backend/migrations/collections_test.go`, `backend/migrations/rules_test.go`
- Test: `backend/internal/material/hooks_test.go`

**Interfaces:**
- Produces: collection `notification_preferences` with `user` (`ownedBy`), text `quiet_from`, `quiet_until`, unique index `idx_notification_preferences_user` on `user`; rate limit label `POST /api/push/test`.

- [ ] **Step 1: Write the failing tests**

In `collections_test.go`, add `notification_preferences` to the collection list and to the create fixtures (`{"user": w.Use.Id}`). In `rules_test.go`, add `TestNotificationPreferencesRules` copying the cases of the `notification_settings` test: creates own, not for others, not reading others, owner updates, owner cannot reassign, owner deletes.

In `hooks_test.go`:

```go
func TestTimingsValidation(t *testing.T)
// accepted: nil, [], [14, 3, 0], [0]
// rejected: [15], [-1], [3, 3], [1.5], ["3"], "14"
func TestQuietTimeValidation(t *testing.T)
// accepted: both empty; "22:00"/"07:00"; "00:00"/"23:59"
// rejected: only one set; "7:00"/"08:00"; "24:00"/"07:00"; "22:60"/"07:00"; "22:00"/"22:00"
func TestSubscriptionEndpointMustBeHTTPS(t *testing.T)
// accepted: https://push.example.com/1; rejected: http://push.example.com/1, ftp://x, not a url
```

Each rejection asserts the field name in the error, via `errors.As` to `validation.Errors`, like the existing hook tests.

- [ ] **Step 2: Run the tests**

Run: `cd backend && go test ./migrations ./internal/material`
Expected: FAIL: unknown collection, missing validation.

- [ ] **Step 3: Implement**

Migration: create the collection, set the same rules as `ownRecord` in `1793380001_rules.go` (`rule(own)` for list, view, remove; `rule(asOwner)` for create; `rule(own, unchanged("user"))` for update), and append `{Label: "POST /api/push/test", MaxRequests: testPushes, Duration: rateLimitWindowSeconds}` with `const testPushes = 5` to `settings.RateLimits.Rules`. The down migration removes both.

Hooks, in `material.Register`:

```go
app.OnRecordValidate("notification_settings").BindFunc(validateTimings)
app.OnRecordValidate("notification_preferences").BindFunc(validateQuietTime)
app.OnRecordValidate("push_subscriptions").BindFunc(validateEndpoint)
```

Error codes `validation_timings`, `validation_quiet_time`, `validation_endpoint`. `validateTimings` unmarshals `e.Record.GetString("timings")`-style raw JSON into `[]float64` so 1.5 can be rejected. HTTPS on endpoints keeps a user from pointing the server's requests at plain internal addresses.

- [ ] **Step 4: Run the tests**

Run: `cd backend && go test ./...`
Expected: PASS. Task 6 tests the rate limit, since the route arrives there.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "add quiet time preferences and validate notification records"
```

---

### Task 2: Shared loader for due dates

**Files:**
- Create: `backend/internal/material/load.go`
- Modify: `backend/internal/material/route.go`, `backend/internal/due/due.go`
- Test: `backend/internal/material/load_test.go`, `backend/internal/due/due_test.go`

**Interfaces:**
- Produces:

```go
package material

// ItemDues is an item with its computed due dates.
type ItemDues struct {
	Record *core.Record
	Result due.Result
}

func PermittedCategories(app core.App, userID string) ([]string, error)
func LoadDues(app core.App, categoryIDs []string, today time.Time) ([]ItemDues, error)
```

```go
package due

// InVienna returns the same instant in Europe/Vienna.
func InVienna(t time.Time) time.Time
```

- [ ] **Step 1: Write the failing tests**

`TestLoadDues`: seeds the World, adds a `passed` check on ItemA, and asserts `LoadDues(app, []string{w.CategoryA.Id}, today)` returns one entry with `Record.Id == w.ItemA.Id` and a `due.KindCheck` due of `w.CheckTypeA.Id`, and nothing of category B. `TestLoadDuesWithoutCategories`: `LoadDues(app, nil, today)` returns no entries and no error. `TestInVienna`: `2026-07-01T22:30Z` is 00:30 and `2026-01-01T23:30Z` is 00:30.

- [ ] **Step 2: Run the tests**

Run: `cd backend && go test ./internal/material ./internal/due`
Expected: FAIL: undefined `LoadDues`, `InVienna`.

- [ ] **Step 3: Move the code**

Move `permittedCategories`, the body of `loadItems` up to `due.Compute`, `calendarDate` and `toAny` to `load.go`. `route.go` keeps `dueJSON`, `itemJSON`, `toItemJSON` and sorting by name, and maps over `LoadDues`. Hooks keep using `calendarDate`.

- [ ] **Step 4: Run the tests**

Run: `cd backend && go test ./internal/material ./internal/due`
Expected: PASS, with `route_test.go` unchanged.

- [ ] **Step 5: Commit**

```bash
git add backend/internal
git commit -m "extract loading items with due dates from the due route"
```

---

### Task 3: Firing rules and message

**Files:**
- Create: `backend/internal/notify/fire.go`, `backend/internal/notify/message.go`
- Test: `backend/internal/notify/fire_test.go`, `backend/internal/notify/message_test.go` (internal package: pure code without `testenv`)

**Interfaces:**
- Produces:

```go
package notify

// Setting is a user's notification_settings row for one category.
type Setting struct {
	Timings       []int
	WeeklyOverdue bool
}

// QuietTime is in minutes after midnight; From == Until means none. From is inside, Until is not.
type QuietTime struct{ From, Until int }

var DefaultQuietTime = QuietTime{From: 22 * 60, Until: 7 * 60}

func ParseQuietTime(from, until string) QuietTime
func (q QuietTime) Contains(minute int) bool

// Timings returns the log timings that fire for a due date. reminders is false before 07:00.
// zeroFired says whether timing "0" already fired for this due date on any day.
func Timings(d due.Due, s Setting, today time.Time, reminders, zeroFired bool) []string

// Reason returns the notification_log reason of a due date.
func Reason(d due.Due) string

// FiredItem is one item in a message, with its most urgent fired state.
type FiredItem struct {
	ID       string
	Category string // category name
	State    due.State
}

// Message is what a user receives. URL is relative to the origin.
type Message struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
}

func BuildMessage(items []FiredItem) Message
```

- [ ] **Step 1: Write the failing tests**

Table `TestTimings`, with today 2026-10-31 and `Setting{Timings: []int{14, 3, 0}, WeeklyOverdue: true}` unless stated:

| Due date | reminders | zeroFired | Expected |
|---|---|---|---|
| 2026-11-14 | true | false | `["14"]` |
| 2026-11-14 | false | false | none |
| 2026-11-13 | true | false | none |
| 2026-10-31 | false | false | `["0"]` |
| 2026-10-31 | true | true | none |
| 2026-10-30 | false | false | `["0"]` |
| 2026-10-24 | true | true | `["overdue"]` |
| 2026-10-24 | true | false | `["0", "overdue"]` |
| 2026-10-24 | false | true | none |
| 2026-10-25 | true | true | none |
| 2026-10-30, `Timings: {3}` | true | false | none |
| 2026-10-24, `WeeklyOverdue: false`, `Timings: {3}` | true | false | none |
| any, `Setting{}` (empty timings, Review Focus 2) | true | false | none |

`TestQuietTime`: for `DefaultQuietTime`, 21:59 outside, 22:00 inside, 23:30 inside, 00:00 inside, 06:59 inside, 07:00 outside. For 13:00–15:00, 13:00 inside and 15:00 outside. `ParseQuietTime("", "")` contains nothing.

`TestReason`: `check:abc`, `end_of_life`, `defect`.

`TestBuildMessage`:
- Two overdue and one due today in Masken, plus one due soon in Leitern: `Title` is `"FF Intern"`, `Body` is `"Leitern: 1 bald fällig\nMasken: 2 überfällig, 1 heute fällig"` (categories by name, states always in this order, zero counts left out, `StateOK` counts as `bald fällig`).
- `URL` is `/material?geraete=a,b,c`, ids sorted.
- 50 items keep the filter, 51 give `/material`.

- [ ] **Step 2: Run the tests**

Run: `cd backend && go test ./internal/notify`
Expected: FAIL: undefined.

- [ ] **Step 3: Implement**

The day difference is `int(d.Date.Sub(today).Hours() / 24)`, which is exact because both are at 00:00 UTC. `"0"` when `difference <= 0`, `0 ∈ Timings` and `!zeroFired`. `"N"` when `reminders`, `difference > 0` and `difference ∈ Timings`. `"overdue"` when `reminders`, `WeeklyOverdue`, `difference < 0` and `difference % 7 == 0`.

- [ ] **Step 4: Run the tests**

Run: `cd backend && go test ./internal/notify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/notify
git commit -m "add notification firing rules and message"
```

---

### Task 4: The job

**Files:**
- Create: `backend/internal/notify/job.go`
- Modify: `backend/internal/testenv/testenv.go` only if a helper is needed by more than one test file
- Test: `backend/internal/notify/job_test.go` (package `notify_test`)

**Interfaces:**
- Consumes: `material.PermittedCategories`, `material.LoadDues`, `due.InVienna`, `due.ViennaDay`, everything from Task 3.
- Produces:

```go
// Sender delivers a message to all devices of a user and says how many accepted it.
type Sender interface {
	Send(userID string, message Message) (delivered int, err error)
}

type Job struct {
	App    core.App
	Sender Sender
	Logger *log.Logger
}

// Run looks at every user once. A user's failure is logged and does not stop the others.
func (j *Job) Run(now time.Time)

// Schedule adds the job to the app's cron, every minute. A run still going skips the next one.
func Schedule(job *Job)
```

- [ ] **Step 1: Write the failing tests**

A fake `Sender` records `(userID, Message)`, and can return an error or `delivered = 0` per user. A helper seeds the World, gives `w.Check` a subscription and a settings row for category A with `timings: [14, 3, 0]`, `weekly_overdue: true`, and sets ItemA's check so its due date is what the test needs. `now` values in Vienna unless stated.

```go
func TestRunSendsReminderAtTiming(t *testing.T)            // due in 14 days, 07:00 → one message, log row timing "14"
func TestRunWaitsFor0700(t *testing.T)                     // same at 06:59 with quiet_from/until empty → nothing
func TestRunSendsNewDueImmediately(t *testing.T)           // use recorded, after_use type, 15:00 → message, timing "0"
func TestRunSendsDefectImmediately(t *testing.T)           // defect check, 15:00 → log reason "defect"
func TestRepeatedRunSendsNothing(t *testing.T)             // Run twice, one message; next day nothing for timing "0"
func TestNewDueDateFiresAgain(t *testing.T)                // passed check, then a later use → second message
func TestQuietTimeHoldsAndReleases(t *testing.T)           // use at 23:00 → nothing; Run at 07:00 → one message
func TestOwnQuietTime(t *testing.T)                        // prefs 09:00–12:00: nothing at 10:00, sent at 12:00
func TestNoQuietTime(t *testing.T)                         // prefs both empty: sent at 03:00
func TestResolvedDuringQuietTimeSendsNothing(t *testing.T) // Review Focus 1: use at 23:00, passed check at 23:30, Run at 07:00 → nothing
func TestSkipsDeactivatedUser(t *testing.T)
func TestNullTimingsAreIgnored(t *testing.T)               // Review Focus 2: one row with null timings, a second row still fires
func TestSkipsCategoryWithoutPermission(t *testing.T)      // settings row for category B → nothing
func TestSkipsUserWithoutSubscription(t *testing.T)        // no message, no log row
func TestGroupsOnePushPerUser(t *testing.T)                // two categories, two items → one message with two lines
func TestFailedDeliveryIsRetried(t *testing.T)             // delivered 0, no log row; next Run sends
func TestOneUserFailingDoesNotStopOthers(t *testing.T)     // Review Focus 3: Sender errors for w.Check, w.Manage still sent
func TestDayFollowsVienna(t *testing.T)                    // Review Focus 4: now 2026-07-01T22:30Z with no quiet time counts as 2 July, due that day fires "0"; winter case 2026-01-01T23:30Z likewise
func TestScheduleAddsJob(t *testing.T)                     // app.Cron().Jobs() holds id "notify" with expression "* * * * *"
```

- [ ] **Step 2: Run the tests**

Run: `cd backend && go test ./internal/notify`
Expected: FAIL: `Job` undefined.

- [ ] **Step 3: Implement `job.go`**

For each user id in `push_subscriptions` (distinct), load the user and skip when `deactivated`:

1. Load their `notification_preferences` (none → `DefaultQuietTime`) and skip when `Contains` the Vienna minute of `now`.
2. Load their settings, drop categories not in `PermittedCategories`, call `LoadDues`. Hold one `Setting` per category.
3. Load their `notification_log` rows with `sent_on = today` or `timing = "0"`. Build a set of `(item, reason, due_date, timing, sent_on)` keys and a set of `(item, reason, due_date)` with timing `"0"`.
4. For each due, call `Timings`, keep timings not already sent today, and remember the item's most urgent state. Row order in `Result.Dues` is earliest first, so the first fired due of an item has the state to use.
5. Nothing fired: next user. Otherwise `Sender.Send(userID, BuildMessage(items))`. With `delivered == 0` or an error, log a warning and write nothing.
6. Save one `notification_log` row per fired timing. `sent_on` and `due_date` are the calendar dates. A failed save is a warning; a unique conflict is expected.

`today` is `due.ViennaDay(now)`, `reminders` is Vienna hour ≥ 7. `Schedule` uses a `sync.Mutex` with `TryLock`, and `app.Cron().MustAdd("notify", "* * * * *", …)` calling `Run(time.Now())`.

- [ ] **Step 4: Run the tests**

Run: `cd backend && go test ./internal/notify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal
git commit -m "add the notification job"
```

---

### Task 5: Web Push sender

**Files:**
- Create: `backend/internal/push/sender.go`
- Modify: `backend/go.mod`, `backend/go.sum`
- Test: `backend/internal/push/sender_test.go` (package `push_test`)

**Interfaces:**
- Consumes: `notify.Message`, `notify.Sender`.
- Produces:

```go
package push

type Keys struct{ Public, Private, Subject string }

// KeysFromEnv reads VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT. ok is false unless all are set.
func KeysFromEnv() (keys Keys, ok bool)

type Sender struct {
	App    core.App
	Keys   Keys
	Client *http.Client // nil means http.DefaultClient
	Logger *log.Logger
}

func (s *Sender) Send(userID string, message notify.Message) (int, error)
```

- [ ] **Step 1: Add the dependency**

Run: `cd backend && go get github.com/SherClockHolmes/webpush-go@v1.4.0`

- [ ] **Step 2: Write the failing tests**

Use `httptest.NewTLSServer` (endpoints must be HTTPS) with `Client: server.Client()`. Subscriptions need real keys: generate `p256dh` with `ecdh.P256().GenerateKey` and a 16-byte `auth`, base64url, and keys with `webpush.GenerateVAPIDKeys`. The server answers per path.

```go
func TestSendReachesEveryDevice(t *testing.T)   // 2 subscriptions, both 201 → delivered 2; requests have a vapid Authorization header
func TestSendRemovesGoneSubscriptions(t *testing.T) // 404 and 410 → rows deleted, delivered 0, no error
func TestSendKeepsOnOtherErrors(t *testing.T)   // 500 → row kept, delivered 0
func TestSendCountsPartialDelivery(t *testing.T) // 201 + 500 → delivered 1
func TestSendOnlyToThatUser(t *testing.T)
func TestKeysFromEnv(t *testing.T)              // all set; one missing → ok false
```

- [ ] **Step 3: Run the tests**

Run: `cd backend && go test ./internal/push`
Expected: FAIL: undefined `Sender`.

- [ ] **Step 4: Implement**

The payload is `json.Marshal(message)`. Call `webpush.SendNotification` with `Options{HTTPClient: …, VAPIDPublicKey, VAPIDPrivateKey, Subscriber: Keys.Subject, TTL: 86400}`, and close the response body. Check in the v1.4.0 source how `Subscriber` treats a `mailto:` prefix, and pass it so the `sub` claim holds exactly one. A network error on one device is logged and counts as not delivered, so the others still get it.

- [ ] **Step 5: Run the tests**

Run: `cd backend && go test ./internal/push`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "add the web push sender"
```

---

### Task 6: Push routes and wiring

**Files:**
- Create: `backend/internal/push/routes.go`
- Modify: `backend/cmd/intern/main.go`
- Test: `backend/internal/push/routes_test.go`

**Interfaces:**
- Produces:

```go
// RegisterRoutes adds the push routes. Without keys, sender is nil, the key route answers 404 and
// test pushes are refused.
func RegisterRoutes(se *core.ServeEvent, keys Keys, sender notify.Sender, logger *log.Logger)
```

| Route | Auth | Body | Answer |
|---|---|---|---|
| `GET /api/push/key` | public | | `{"publicKey": "…"}`, or 404 without keys |
| `POST /api/push/subscribe` | required | `{"endpoint","p256dh","auth","deviceLabel"}` | 204; 400 on a missing or invalid field |
| `POST /api/push/test` | required | | `{"delivered": n}`; 404 without keys |

- [ ] **Step 1: Write the failing tests**

```go
func TestKeyRouteIsPublic(t *testing.T)          // anonymous 200 with the key
func TestKeyRouteWithoutKeys(t *testing.T)       // 404
func TestSubscribeNeedsAuth(t *testing.T)        // 401
func TestSubscribeCreates(t *testing.T)          // 204, row owned by the caller
func TestSubscribeTakesOverEndpoint(t *testing.T) // same endpoint by another user → one row, new owner, new keys
func TestSubscribeRefreshesOwnRow(t *testing.T)  // same user twice → one row
func TestSubscribeRejectsHTTP(t *testing.T)      // endpoint http://… → 400
func TestTestPushCountsDelivered(t *testing.T)   // fake Sender → {"delivered":1}, no notification_log row
func TestTestPushNeedsAuth(t *testing.T)         // 401
func TestTestPushWithoutKeys(t *testing.T)       // 404
func TestTestPushIsRateLimited(t *testing.T)     // like TestConfirmFinishIsRateLimited: the sixth in a minute answers 429
```

Use the `newHarness` shape of `passkey/routes_test.go` (one router from `apis.NewRouter`).

- [ ] **Step 2: Run the tests**

Run: `cd backend && go test ./internal/push`
Expected: FAIL: undefined `RegisterRoutes`.

- [ ] **Step 3: Implement the routes**

Subscribe finds the row with `FindFirstRecordByData("push_subscriptions", "endpoint", endpoint)`, or starts a new record, sets all fields and saves. Validation errors from Task 1 answer 400.

- [ ] **Step 4: Wire `main.go`**

```go
keys, pushEnabled := push.KeysFromEnv()
```

In `OnServe`: with `pushEnabled`, create `&push.Sender{…}`, call `push.RegisterRoutes(se, keys, sender, logger)` and `notify.Schedule(&notify.Job{App: app, Sender: sender, Logger: logger})`. Without it, `push.RegisterRoutes(se, keys, nil, logger)` and `logger.Warn("push is not set up, VAPID keys are missing")`.

Add a `vapid` cobra command to `app.RootCmd` that calls `webpush.GenerateVAPIDKeys` and writes to stdout:

```
VAPID_PUBLIC_KEY=…
VAPID_PRIVATE_KEY=…
```

This is program output, so `fmt.Println` is right here.

- [ ] **Step 5: Run the tests and try the command**

Run: `cd backend && go test ./... && go run ./cmd/intern vapid`
Expected: PASS and two lines of keys.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "add push routes, intern vapid and schedule the job"
```

---

### Task 7: Frontend API and Settings

**Files:**
- Create: `web/src/api/notifications.ts`, `web/src/api/push.ts`, `web/src/test/fakeNotifications.ts`, `web/src/test/fakePush.ts`, `web/src/components/NotificationSettings.tsx`
- Modify: `web/src/pages/SettingsPage.tsx`, `web/src/test/setup.ts`, `web/src/pages/pages.test.tsx`, `web/src/App.test.tsx`
- Test: `web/src/api/notifications.test.ts`, `web/src/api/push.test.ts`, `web/src/pages/pages.test.tsx`

**Interfaces:**
- Produces:

```ts
// api/notifications.ts
export interface NotificationSetting { id: string; categoryId: string; timings: number[]; weeklyOverdue: boolean }
export interface QuietTime { from: string; until: string }  // empty strings mean off
export const defaultQuietTime: QuietTime  // 22:00, 07:00
export const defaultTimings: number[]     // [14, 3, 0]
export function listNotificationSettings(): Promise<NotificationSetting[]>
export function enableCategory(categoryId: string): Promise<void>     // new row with the defaults
export function updateSetting(id: string, change: { timings?: number[]; weeklyOverdue?: boolean }): Promise<void>
export function disableCategory(id: string): Promise<void>            // deletes the row
export function loadQuietTime(): Promise<QuietTime>                   // defaultQuietTime without a row
export function saveQuietTime(quiet: QuietTime): Promise<void>        // creates or updates the row

// api/push.ts
export type PushSupport = 'unsupported' | 'needsInstall' | 'ready'
export function pushSupport(): PushSupport
export function pushAvailable(): Promise<boolean>  // false when /api/push/key answers 404
export function pushEnabled(): Promise<boolean>    // this browser has a subscription
export function enablePush(): Promise<void>        // throws PushDeniedError when permission is refused
export function disablePush(): Promise<void>       // never rejects
export function syncPush(): Promise<void>          // never rejects
export function sendTestPush(): Promise<number>    // delivered devices
```

`PushDeniedError` joins `api/errors.ts`. `fakeNotifications.ts` and `fakePush.ts` follow `fakePasskeys.ts`: exported state objects, reset in `setup.ts`. Add `vi.mock` lines for both to every test file that renders `App`, and mention the fakes in `CLAUDE.md`.

- [ ] **Step 1: Write the failing API tests**

`push.test.ts` stubs `navigator.serviceWorker`, `PushManager` and `Notification`:

- `pushSupport`: no `PushManager` and iOS user agent outside standalone → `needsInstall`; no `PushManager` elsewhere → `unsupported`; present → `ready`.
- `enablePush`: requests permission, subscribes with `userVisibleOnly: true` and the key as `Uint8Array`, posts to `/api/push/subscribe` with `endpoint`, `p256dh`, `auth` (base64url) and `deviceLabel` = `navigator.userAgent`. Denied → `PushDeniedError`, nothing posted.
- `disablePush`: unsubscribes the browser, deletes the row found by endpoint. A failed delete does not reject.
- `syncPush`: with a subscription, posts it; without one, does nothing; a failed post does not reject.

`notifications.test.ts`: maps records to camelCase; `saveQuietTime` creates without a row and updates with one; `enableCategory` sends `timings: [14, 3, 0]`, `weekly_overdue: true` and the user's id.

- [ ] **Step 2: Write the failing page tests**

In `pages.test.tsx`, `describe('notification settings')`:

```ts
it('offers each permitted category')           // labels 'Masken' as checkboxes under 'Benachrichtigungen'
it('turning a category on creates its setting with chips') // chips 14, 7, 3, 1, 'Am Tag' shown; 14, 3, 'Am Tag' active
it('toggling a chip saves the timings')
it('turning a category off deletes the setting')
it('shows the default quiet time before anything is saved') // Von 22:00, Bis 07:00, 'Ruhezeit' checked
it('saves a changed quiet time')
it('turning quiet time off saves empty times')
it('rejects equal times')                       // 'Von und Bis dürfen nicht gleich sein.', nothing saved
it('enables push on this device')
it('shows the install guide on iOS')            // 'Zum Home-Bildschirm hinzufügen'
it('says when push is not set up')              // 'Push ist auf diesem Server nicht eingerichtet.'
it('says when permission was refused')          // 'Benachrichtigungen sind im Browser blockiert.'
it('sends a test push')                         // 'Testnachricht an 1 Gerät gesendet.'
```

- [ ] **Step 3: Run the tests**

Run: `npm --prefix web test -- src/api src/pages`
Expected: FAIL: modules not found, texts missing.

- [ ] **Step 4: Implement**

`NotificationSettings.tsx` holds one `useResource` loading categories, settings, quiet time and push state, rendered inside `SettingsPage` above the passkeys. Category and Ruhezeit checkboxes use `CheckboxField`, chips `IonChip` as on the due list, and times `Field` with `type="time"`. Chips and checkboxes save at once; the two times save with a „Ruhezeit speichern“ button. `timings` rows from `/_/` that hold values outside the chips keep them when a chip is toggled. Save errors show „Speichern fehlgeschlagen.“ as `SettingsPage` does.

- [ ] **Step 5: Run the tests**

Run: `npm --prefix web run typecheck && npm --prefix web test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web CLAUDE.md
git commit -m "add notification settings and push on this device"
```

---

### Task 8: Service worker, logout, due list filter

**Files:**
- Create: `web/public/push-sw.js`
- Modify: `web/vite.config.ts`, `web/src/session.tsx`, `web/src/pages/DueListPage.tsx`, `web/src/routes.ts`, `web/src/pages/pages.test.tsx`, `web/src/App.test.tsx`

**Interfaces:**
- Consumes: `disablePush`, `syncPush` from Task 7.
- Produces: `paths.dueListOf(ids: string[])` → `/material?geraete=a,b`; `Session.logout` becomes `() => Promise<void>`.

- [ ] **Step 1: Write the failing tests**

```ts
// App.test.tsx
it('logging out turns push off on this device before ending the session')
// pushState records 'disable' while the user is still signed in
it('syncs the subscription after login')

// pages.test.tsx, describe('due list')
it('limits the list to the items of a notification')   // paths.dueListOf(['m1','m2']) shows those, not Maske 03
it('shows everything after Alle anzeigen')             // chip clears ?geraete=
it('says when the items of a notification are done')   // Review Focus 5: ids only of ok-state items → 'Alles aus dieser Benachrichtigung ist erledigt.', chip still there
it('ignores unknown ids')                              // one known, one unknown → the known one
```

Take the item ids from `fakeMaterial.ts`.

- [ ] **Step 2: Run the tests**

Run: `npm --prefix web test -- src/App.test.tsx src/pages`
Expected: FAIL.

- [ ] **Step 3: Implement**

`session.tsx`: `logout: async () => { await push.disablePush(); auth.logout() }`, and an effect on `user?.id` that calls `push.syncPush()` when signed in.

`DueListPage.tsx`: read `geraete` with `new URLSearchParams(useLocation().search)` as `ManagePage` does. With ids, `visible` also needs the item's id in them, and a chip „Alle anzeigen“ calls `navigate(paths.dueList, { replace: true })`. When none of the ids is in a due group, show the done text in place of the groups.

`vite.config.ts`: add `importScripts: ['push-sw.js']` to `workbox`.

`web/public/push-sw.js`:

```js
self.addEventListener('push', (event) => {
  const { title, body, url } = event.data.json()
  event.waitUntil(self.registration.showNotification(title, { body, icon: '/icons/intern-192.png', data: { url } }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data.url
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(([client]) => {
      if (!client) return self.clients.openWindow(url)
      return client.focus().then((focused) => focused.navigate(url))
    }),
  )
})
```

- [ ] **Step 4: Run the tests and the build**

Run: `npm --prefix web run typecheck && npm --prefix web test && make build && grep -c 'push-sw.js' backend/ui/dist/sw.js`
Expected: PASS, and a count of at least 1.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "handle pushes in the service worker, filter the due list by them"
```

---

### Task 9: Real browser check and docs

**Files:**
- Modify: `docs/superpowers/STATUS.md`, `CLAUDE.md`

- [ ] **Step 1: Check the whole path in a browser**

Run the built server with keys from `intern vapid` and a scratch data dir from `go run ./cmd/seed <dir>`, as in the environment notes of `STATUS.md`. In Chromium with a Playwright script: log in, grant notifications, turn on a category and push, and confirm a row in `push_subscriptions`. Press the test button, record a use, and confirm a `notification_log` row with timing `0` within about a minute. Headless Chromium may have no route to a push service. If a delivery cannot be observed, say so in the PR and leave it for the device check after deploy.

- [ ] **Step 2: Run all checks**

Run: `make test && (cd backend && govulncheck ./...) && npm --prefix web audit`
Expected: tests PASS, and no scan findings beyond those listed in `STATUS.md`.

- [ ] **Step 3: Update the docs**

`STATUS.md`: phase 4 done with this plan and its PR, move the phases up. `CLAUDE.md`: under Commands, that push needs `VAPID_*` set for `make dev-api` (from `intern vapid`) and a built service worker, since Vite's dev server does not register one.

- [ ] **Step 4: Commit**

```bash
git add docs CLAUDE.md
git commit -m "update docs after phase 4"
```
