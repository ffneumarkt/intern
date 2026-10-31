package notify_test

import (
	"bytes"
	"errors"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/charmbracelet/log"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/notify"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

type sent struct {
	userID  string
	message notify.Message
}

// fakeSender records messages. By default every message is delivered to one device.
type fakeSender struct {
	mu        sync.Mutex
	sent      []sent
	fail      map[string]error
	delivered map[string]int
	onSend    func(userID string) // runs during Send, like a concurrent run would
}

func (s *fakeSender) Send(userID string, message notify.Message) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.onSend != nil {
		s.onSend(userID)
	}
	if err := s.fail[userID]; err != nil {
		return 0, err
	}
	if n, ok := s.delivered[userID]; ok {
		if n > 0 {
			s.sent = append(s.sent, sent{userID, message})
		}
		return n, nil
	}
	s.sent = append(s.sent, sent{userID, message})
	return 1, nil
}

func (s *fakeSender) to(userID string) []notify.Message {
	var out []notify.Message
	for _, m := range s.sent {
		if m.userID == userID {
			out = append(out, m.message)
		}
	}
	return out
}

type env struct {
	t       *testing.T
	app     core.App
	w       *testenv.World
	sender  *fakeSender
	job     *notify.Job
	logs    *bytes.Buffer
	setting *core.Record
}

// setup seeds the World and gives w.Check a subscription and a settings row for category A.
func setup(t *testing.T) *env {
	t.Helper()
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	e := &env{t: t, app: app, w: w, sender: &fakeSender{}, logs: &bytes.Buffer{}}
	e.job = &notify.Job{App: app, Sender: e.sender, Logger: log.New(e.logs)}
	e.subscribe(w.Check)
	e.setting = e.settings(w.Check, w.CategoryA, []int{14, 3, 0})
	return e
}

func (e *env) subscribe(user *core.Record) {
	e.t.Helper()
	testenv.Create(e.t, e.app, "push_subscriptions", map[string]any{
		"user": user.Id, "endpoint": "https://push.example.com/" + user.Id, "p256dh": "k", "auth": "a"})
}

func (e *env) settings(user, category *core.Record, timings []int) *core.Record {
	e.t.Helper()
	return testenv.Create(e.t, e.app, "notification_settings", map[string]any{
		"user": user.Id, "category": category.Id, "timings": timings, "weekly_overdue": true})
}

func (e *env) quietTime(user *core.Record, from, until string) {
	e.t.Helper()
	testenv.Create(e.t, e.app, "notification_preferences", map[string]any{
		"user": user.Id, "quiet_from": from, "quiet_until": until})
}

// dueOn records a passed check 12 months before date, so the 12-month check type is due on date.
func (e *env) dueOn(item, checkType *core.Record, date string) {
	e.t.Helper()
	d := parseDay(date).AddDate(-1, 0, 0)
	e.check(item, checkType, d.Format(time.DateOnly), "passed")
}

func (e *env) check(item, checkType *core.Record, date, result string) {
	e.t.Helper()
	testenv.Create(e.t, e.app, "checks", map[string]any{"item": item.Id, "check_type": checkType.Id,
		"date": date, "result": result, "performed_by": e.w.Check.Id})
}

func (e *env) use(item *core.Record, date string) {
	e.t.Helper()
	testenv.Create(e.t, e.app, "uses", map[string]any{"item": item.Id, "date": date, "kind": "exercise", "created_by": e.w.Check.Id})
}

// afterUse makes check type A due after each use, besides its interval.
func (e *env) afterUse() {
	e.t.Helper()
	e.w.CheckTypeA.Set("after_use", true)
	if err := e.app.Save(e.w.CheckTypeA); err != nil {
		e.t.Fatal(err)
	}
}

func (e *env) logRows(user *core.Record) []*core.Record {
	e.t.Helper()
	rows, err := e.app.FindAllRecords("notification_log", dbx.HashExp{"user": user.Id})
	if err != nil {
		e.t.Fatal(err)
	}
	return rows
}

func (e *env) wantMessages(user *core.Record, n int) []notify.Message {
	e.t.Helper()
	got := e.sender.to(user.Id)
	if len(got) != n {
		e.t.Fatalf("%s got %d messages, want %d: %+v\nlogs:\n%s", user.GetString("name"), len(got), n, got, e.logs)
	}
	return got
}

func (e *env) wantLog(user *core.Record, reason, dueDate, timing, sentOn string) {
	e.t.Helper()
	rows := e.logRows(user)
	for _, r := range rows {
		if r.GetString("reason") == reason && day(r, "due_date") == dueDate &&
			r.GetString("timing") == timing && day(r, "sent_on") == sentOn {
			return
		}
	}
	var have []string
	for _, r := range rows {
		have = append(have, r.GetString("reason")+" "+day(r, "due_date")+" "+r.GetString("timing")+" "+day(r, "sent_on"))
	}
	e.t.Errorf("no log row %s %s %s %s; have %v", reason, dueDate, timing, sentOn, have)
}

func day(r *core.Record, field string) string {
	return r.GetDateTime(field).Time().UTC().Format(time.DateOnly)
}

func parseDay(s string) time.Time {
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return d
}

var vienna = func() *time.Location {
	loc, err := time.LoadLocation("Europe/Vienna")
	if err != nil {
		panic(err)
	}
	return loc
}()

// at returns a Vienna wall clock time as a UTC instant, so the job has to convert it.
func at(s string) time.Time {
	t, err := time.ParseInLocation("2006-01-02 15:04", s, vienna)
	if err != nil {
		panic(err)
	}
	return t.UTC()
}

func TestRunSendsReminderAtTiming(t *testing.T) {
	e := setup(t)
	e.dueOn(e.w.ItemA, e.w.CheckTypeA, "2026-06-15")

	e.job.Run(at("2026-06-01 07:00"))

	m := e.wantMessages(e.w.Check, 1)
	if m[0].Body != "A: 1 bald fällig" || m[0].URL != "/material?geraete="+e.w.ItemA.Id {
		t.Errorf("message %+v", m[0])
	}
	e.wantLog(e.w.Check, "check:"+e.w.CheckTypeA.Id, "2026-06-15", "14", "2026-06-01")
	if n := len(e.logRows(e.w.Check)); n != 1 {
		t.Errorf("%d log rows, want 1", n)
	}
}

func TestRunWaitsFor0700(t *testing.T) {
	e := setup(t)
	e.quietTime(e.w.Check, "", "")
	e.dueOn(e.w.ItemA, e.w.CheckTypeA, "2026-06-15")

	e.job.Run(at("2026-06-01 06:59"))

	e.wantMessages(e.w.Check, 0)
	if n := len(e.logRows(e.w.Check)); n != 0 {
		t.Errorf("%d log rows, want 0", n)
	}
}

func TestRunSendsNewDueImmediately(t *testing.T) {
	e := setup(t)
	e.afterUse()
	e.check(e.w.ItemA, e.w.CheckTypeA, "2026-06-01", "passed")
	e.use(e.w.ItemA, "2026-06-10")

	e.job.Run(at("2026-06-10 15:00"))

	m := e.wantMessages(e.w.Check, 1)
	if m[0].Body != "A: 1 heute fällig" {
		t.Errorf("body %q", m[0].Body)
	}
	e.wantLog(e.w.Check, "check:"+e.w.CheckTypeA.Id, "2026-06-10", "0", "2026-06-10")
}

func TestRunSendsDefectImmediately(t *testing.T) {
	e := setup(t)
	e.check(e.w.ItemA, e.w.CheckTypeA, "2026-06-01", "passed")
	e.check(e.w.ItemA, e.w.CheckTypeA, "2026-06-10", "defect")

	e.job.Run(at("2026-06-10 15:00"))

	e.wantMessages(e.w.Check, 1)
	e.wantLog(e.w.Check, "defect", "2026-06-10", "0", "2026-06-10")
}

func TestRepeatedRunSendsNothing(t *testing.T) {
	e := setup(t)
	e.afterUse()
	e.check(e.w.ItemA, e.w.CheckTypeA, "2026-06-01", "passed")
	e.use(e.w.ItemA, "2026-06-10")

	e.job.Run(at("2026-06-10 15:00"))
	e.job.Run(at("2026-06-10 15:01"))
	e.wantMessages(e.w.Check, 1)

	e.job.Run(at("2026-06-11 15:00"))
	e.wantMessages(e.w.Check, 1)
	if n := len(e.logRows(e.w.Check)); n != 1 {
		t.Errorf("%d log rows, want 1", n)
	}

	t.Run("reminder", func(t *testing.T) {
		e := setup(t)
		e.dueOn(e.w.ItemA, e.w.CheckTypeA, "2026-06-15")

		e.job.Run(at("2026-06-01 07:00"))
		e.job.Run(at("2026-06-01 07:01"))

		e.wantMessages(e.w.Check, 1)
	})
}

func TestNewDueDateFiresAgain(t *testing.T) {
	e := setup(t)
	e.afterUse()
	e.check(e.w.ItemA, e.w.CheckTypeA, "2026-06-01", "passed")
	e.use(e.w.ItemA, "2026-06-10")
	e.job.Run(at("2026-06-10 15:00"))

	e.check(e.w.ItemA, e.w.CheckTypeA, "2026-06-11", "passed")
	e.use(e.w.ItemA, "2026-06-12")
	e.job.Run(at("2026-06-12 15:00"))

	e.wantMessages(e.w.Check, 2)
	e.wantLog(e.w.Check, "check:"+e.w.CheckTypeA.Id, "2026-06-12", "0", "2026-06-12")
}

func TestQuietTimeHoldsAndReleases(t *testing.T) {
	e := setup(t)
	e.afterUse()
	e.check(e.w.ItemA, e.w.CheckTypeA, "2026-06-01", "passed")
	e.use(e.w.ItemA, "2026-06-10")

	e.job.Run(at("2026-06-10 23:00"))
	e.wantMessages(e.w.Check, 0)

	e.job.Run(at("2026-06-11 07:00"))
	m := e.wantMessages(e.w.Check, 1)
	if m[0].Body != "A: 1 überfällig" {
		t.Errorf("body %q", m[0].Body)
	}
	e.wantLog(e.w.Check, "check:"+e.w.CheckTypeA.Id, "2026-06-10", "0", "2026-06-11")
}

func TestOwnQuietTime(t *testing.T) {
	e := setup(t)
	e.quietTime(e.w.Check, "09:00", "12:00")
	e.afterUse()
	e.check(e.w.ItemA, e.w.CheckTypeA, "2026-06-01", "passed")
	e.use(e.w.ItemA, "2026-06-10")

	e.job.Run(at("2026-06-10 10:00"))
	e.wantMessages(e.w.Check, 0)

	e.job.Run(at("2026-06-10 12:00"))
	e.wantMessages(e.w.Check, 1)
}

func TestNoQuietTime(t *testing.T) {
	e := setup(t)
	e.quietTime(e.w.Check, "", "")
	e.afterUse()
	e.check(e.w.ItemA, e.w.CheckTypeA, "2026-06-01", "passed")
	e.use(e.w.ItemA, "2026-06-10")

	e.job.Run(at("2026-06-10 03:00"))

	e.wantMessages(e.w.Check, 1)
	if strings.Contains(e.logs.String(), "quiet") {
		t.Errorf("empty quiet time logged a warning:\n%s", e.logs)
	}
}

func TestInvalidStoredQuietTimeWarns(t *testing.T) {
	e := setup(t)
	c, err := e.app.FindCollectionByNameOrId("notification_preferences")
	if err != nil {
		t.Fatal(err)
	}
	prefs := core.NewRecord(c)
	prefs.Load(map[string]any{"user": e.w.Check.Id, "quiet_from": "nachts", "quiet_until": "07:00"})
	if err := e.app.SaveNoValidate(prefs); err != nil {
		t.Fatal(err)
	}
	e.afterUse()
	e.check(e.w.ItemA, e.w.CheckTypeA, "2026-06-01", "passed")
	e.use(e.w.ItemA, "2026-06-10")

	e.job.Run(at("2026-06-10 03:00"))

	e.wantMessages(e.w.Check, 1)
	if !strings.Contains(e.logs.String(), "WARN") || !strings.Contains(e.logs.String(), "nachts") {
		t.Errorf("no warning about the quiet time:\n%s", e.logs)
	}
}

func TestResolvedDuringQuietTimeSendsNothing(t *testing.T) {
	e := setup(t)
	e.afterUse()
	e.check(e.w.ItemA, e.w.CheckTypeA, "2026-06-01", "passed")
	e.use(e.w.ItemA, "2026-06-10")

	e.job.Run(at("2026-06-10 23:00"))
	e.check(e.w.ItemA, e.w.CheckTypeA, "2026-06-10", "passed") // at 23:30
	e.job.Run(at("2026-06-11 07:00"))

	e.wantMessages(e.w.Check, 0)
	if n := len(e.logRows(e.w.Check)); n != 0 {
		t.Errorf("%d log rows, want 0", n)
	}
}

func TestSkipsDeactivatedUser(t *testing.T) {
	e := setup(t)
	e.dueOn(e.w.ItemA, e.w.CheckTypeA, "2026-06-15")
	e.w.Check.Set("deactivated", true)
	if err := e.app.Save(e.w.Check); err != nil {
		t.Fatal(err)
	}

	e.job.Run(at("2026-06-01 07:00"))

	e.wantMessages(e.w.Check, 0)
}

func TestNullTimingsAreIgnored(t *testing.T) {
	for name, value := range map[string]any{
		"null":    nil,
		"string":  "abc",
		"mixed":   []any{14, "x"},
		"object":  map[string]any{"14": true},
		"decimal": []any{14.5},
	} {
		t.Run(name, func(t *testing.T) {
			e := setup(t)
			e.setting.Set("timings", value)
			if err := e.app.SaveNoValidate(e.setting); err != nil {
				t.Fatal(err)
			}
			testenv.Permit(t, e.app, e.w.Check, e.w.CategoryB, "check")
			e.settings(e.w.Check, e.w.CategoryB, []int{14})
			e.dueOn(e.w.ItemA, e.w.CheckTypeA, "2026-06-15")
			e.dueOn(e.w.ItemB, e.w.CheckTypeB, "2026-06-15")

			e.job.Run(at("2026-06-01 07:00"))

			m := e.wantMessages(e.w.Check, 1)
			if m[0].Body != "B: 1 bald fällig" {
				t.Errorf("body %q", m[0].Body)
			}
		})
	}
}

func TestSkipsCategoryWithoutPermission(t *testing.T) {
	e := setup(t)
	e.setting.Set("category", e.w.CategoryB.Id)
	if err := e.app.Save(e.setting); err != nil {
		t.Fatal(err)
	}
	e.dueOn(e.w.ItemB, e.w.CheckTypeB, "2026-06-15")

	e.job.Run(at("2026-06-01 07:00"))

	e.wantMessages(e.w.Check, 0)
}

func TestSkipsUserWithoutSubscription(t *testing.T) {
	e := setup(t)
	subs, err := e.app.FindAllRecords("push_subscriptions", dbx.HashExp{"user": e.w.Check.Id})
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range subs {
		if err := e.app.Delete(s); err != nil {
			t.Fatal(err)
		}
	}
	e.dueOn(e.w.ItemA, e.w.CheckTypeA, "2026-06-15")

	e.job.Run(at("2026-06-01 07:00"))

	if len(e.sender.sent) != 0 {
		t.Errorf("sent %+v", e.sender.sent)
	}
	if n := len(e.logRows(e.w.Check)); n != 0 {
		t.Errorf("%d log rows, want 0", n)
	}
}

func TestGroupsOnePushPerUser(t *testing.T) {
	e := setup(t)
	testenv.Permit(t, e.app, e.w.Check, e.w.CategoryB, "check")
	e.settings(e.w.Check, e.w.CategoryB, []int{14, 3, 0})
	e.dueOn(e.w.ItemA, e.w.CheckTypeA, "2026-06-15")
	e.dueOn(e.w.ItemB, e.w.CheckTypeB, "2026-06-04")

	e.job.Run(at("2026-06-01 07:00"))

	m := e.wantMessages(e.w.Check, 1)
	if m[0].Body != "A: 1 bald fällig\nB: 1 bald fällig" {
		t.Errorf("body %q", m[0].Body)
	}
	ids := []string{e.w.ItemA.Id, e.w.ItemB.Id}
	slices.Sort(ids)
	if want := "/material?geraete=" + strings.Join(ids, ","); m[0].URL != want {
		t.Errorf("url %q, want %q", m[0].URL, want)
	}
	if n := len(e.logRows(e.w.Check)); n != 2 {
		t.Errorf("%d log rows, want 2", n)
	}
}

func TestLogConflictCountsAsSent(t *testing.T) {
	e := setup(t)
	e.dueOn(e.w.ItemA, e.w.CheckTypeA, "2026-06-15")
	e.job.Logger.SetLevel(log.DebugLevel)
	// Another run logs the same timing between this run's history load and its save.
	e.sender.onSend = func(userID string) {
		testenv.Create(t, e.app, "notification_log", map[string]any{
			"user": userID, "item": e.w.ItemA.Id, "reason": "check:" + e.w.CheckTypeA.Id,
			"due_date": "2026-06-15", "timing": "14", "sent_on": "2026-06-01"})
	}

	e.job.Run(at("2026-06-01 07:00"))

	e.wantMessages(e.w.Check, 1)
	if n := len(e.logRows(e.w.Check)); n != 1 {
		t.Errorf("%d log rows, want 1", n)
	}
	logs := e.logs.String()
	if strings.Contains(logs, "WARN") || strings.Contains(logs, "ERRO") {
		t.Errorf("conflict logged as a problem:\n%s", logs)
	}
	if !strings.Contains(logs, "already logged") {
		t.Errorf("conflict not logged at debug:\n%s", logs)
	}

	e.sender.onSend = nil
	e.job.Run(at("2026-06-01 07:01"))
	e.wantMessages(e.w.Check, 1)
}

func TestFailedDeliveryIsRetried(t *testing.T) {
	e := setup(t)
	e.dueOn(e.w.ItemA, e.w.CheckTypeA, "2026-06-15")
	e.sender.delivered = map[string]int{e.w.Check.Id: 0}

	e.job.Run(at("2026-06-01 07:00"))
	if n := len(e.logRows(e.w.Check)); n != 0 {
		t.Fatalf("%d log rows after a failed delivery, want 0", n)
	}

	e.sender.delivered = nil
	e.job.Run(at("2026-06-01 07:01"))
	e.wantMessages(e.w.Check, 1)
	e.wantLog(e.w.Check, "check:"+e.w.CheckTypeA.Id, "2026-06-15", "14", "2026-06-01")
}

func TestOneUserFailingDoesNotStopOthers(t *testing.T) {
	e := setup(t)
	e.subscribe(e.w.Manage)
	e.settings(e.w.Manage, e.w.CategoryA, []int{14})
	e.dueOn(e.w.ItemA, e.w.CheckTypeA, "2026-06-15")
	e.sender.fail = map[string]error{e.w.Check.Id: errors.New("push service down")}

	e.job.Run(at("2026-06-01 07:00"))

	e.wantMessages(e.w.Manage, 1)
	e.wantMessages(e.w.Check, 0)
	if n := len(e.logRows(e.w.Check)); n != 0 {
		t.Errorf("%d log rows for the failed user, want 0", n)
	}
	if n := len(e.logRows(e.w.Manage)); n != 1 {
		t.Errorf("%d log rows for the other user, want 1", n)
	}
	if !strings.Contains(e.logs.String(), "push service down") {
		t.Errorf("error not logged:\n%s", e.logs)
	}
}

func TestDayFollowsVienna(t *testing.T) {
	for name, tt := range map[string]struct{ due, now string }{
		"summer": {"2026-07-02", "2026-07-01T22:30:00Z"},
		"winter": {"2026-01-02", "2026-01-01T23:30:00Z"},
	} {
		t.Run(name, func(t *testing.T) {
			e := setup(t)
			e.quietTime(e.w.Check, "", "")
			e.dueOn(e.w.ItemA, e.w.CheckTypeA, tt.due)
			now, err := time.Parse(time.RFC3339, tt.now)
			if err != nil {
				t.Fatal(err)
			}

			e.job.Run(now)

			e.wantMessages(e.w.Check, 1)
			e.wantLog(e.w.Check, "check:"+e.w.CheckTypeA.Id, tt.due, "0", tt.due)
		})
	}
}

func TestReminderHourFollowsVienna(t *testing.T) {
	for name, tt := range map[string]struct {
		due, now string
		want     int
	}{
		"summer 07:00": {"2026-06-15", "2026-06-01T05:00:00Z", 1},
		"summer 06:59": {"2026-06-15", "2026-06-01T04:59:00Z", 0},
		"winter 07:00": {"2026-01-29", "2026-01-15T06:00:00Z", 1},
		"winter 06:59": {"2026-01-29", "2026-01-15T05:59:00Z", 0},
	} {
		t.Run(name, func(t *testing.T) {
			e := setup(t)
			e.quietTime(e.w.Check, "", "")
			e.dueOn(e.w.ItemA, e.w.CheckTypeA, tt.due)
			now, err := time.Parse(time.RFC3339, tt.now)
			if err != nil {
				t.Fatal(err)
			}

			e.job.Run(now)

			e.wantMessages(e.w.Check, tt.want)
		})
	}
}

func TestScheduleAddsJob(t *testing.T) {
	app := testenv.New(t)
	notify.Schedule(&notify.Job{App: app, Sender: &fakeSender{}, Logger: log.New(&bytes.Buffer{})})

	for _, j := range app.Cron().Jobs() {
		if j.Id() == "notify" {
			if j.Expression() != "* * * * *" {
				t.Errorf("expression %q", j.Expression())
			}
			return
		}
	}
	t.Error("no job notify")
}
