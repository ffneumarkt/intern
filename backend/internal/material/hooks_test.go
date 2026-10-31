package material_test

import (
	"errors"
	validation "github.com/go-ozzo/ozzo-validation/v4"
	"net/http"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/ffneumarkt/intern/backend/internal/due"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

func addCheck(t *testing.T, app core.App, w *testenv.World, result string) *core.Record {
	t.Helper()
	return testenv.Create(t, app, "checks", map[string]any{"item": w.ItemA.Id, "check_type": w.CheckTypeA.Id,
		"date": "2026-10-01", "result": result, "performed_by": w.Check.Id})
}

func itemStatus(t *testing.T, app core.App, id string) string {
	t.Helper()
	item, err := app.FindRecordById("items", id)
	if err != nil {
		t.Fatal(err)
	}
	return item.GetString("status")
}

func TestCheckResultSetsItemStatus(t *testing.T) {
	tests := []struct{ before, result, after string }{
		{"active", "passed", "active"},
		{"defective", "passed", "active"},
		{"active", "defect", "defective"},
		{"defective", "defect", "defective"},
		{"active", "retired", "retired"},
		{"defective", "retired", "retired"},
	}
	for _, tt := range tests {
		t.Run(tt.before+" "+tt.result, func(t *testing.T) {
			app := testenv.New(t)
			w := testenv.Seed(t, app)
			w.ItemA.Set("status", tt.before)
			if err := app.Save(w.ItemA); err != nil {
				t.Fatal(err)
			}
			addCheck(t, app, w, tt.result)
			if got := itemStatus(t, app, w.ItemA.Id); got != tt.after {
				t.Errorf("status = %s, want %s", got, tt.after)
			}
		})
	}
}

func TestCheckRollsBackWhenTheItemCannotBeUpdated(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	app.OnRecordUpdate("items").BindFunc(func(e *core.RecordEvent) error {
		return errors.New("item update failed")
	})

	c, err := app.FindCollectionByNameOrId("checks")
	if err != nil {
		t.Fatal(err)
	}
	check := core.NewRecord(c)
	check.Load(map[string]any{"item": w.ItemA.Id, "check_type": w.CheckTypeA.Id, "date": "2026-10-01",
		"result": "defect", "performed_by": w.Check.Id})
	if err := app.Save(check); err == nil {
		t.Fatal("save succeeded")
	}
	if n, err := app.CountRecords("checks"); err != nil || n != 0 {
		t.Errorf("%d checks left, err %v", n, err)
	}
}

func TestCheckTypeValidation(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	c, err := app.FindCollectionByNameOrId("check_types")
	if err != nil {
		t.Fatal(err)
	}
	build := func(data map[string]any) *core.Record {
		record := core.NewRecord(c)
		record.Load(map[string]any{"category": w.CategoryA.Id, "name": "x"})
		record.Load(data)
		return record
	}

	if err := app.Save(build(nil)); err == nil {
		t.Error("no trigger accepted")
	}
	if err := app.Save(build(map[string]any{"after_use": true})); err != nil {
		t.Errorf("after use rejected: %v", err)
	}
	if err := app.Save(build(map[string]any{"interval_months": 12, "also_satisfies": []string{w.CheckTypeB.Id}})); err == nil {
		t.Error("also_satisfies of another category accepted on create")
	}
	if err := app.Save(build(map[string]any{"interval_months": 12, "also_satisfies": []string{w.CheckTypeA.Id}})); err != nil {
		t.Errorf("same category rejected: %v", err)
	}

	w.CheckTypeA.Set("also_satisfies", []string{w.CheckTypeB.Id})
	if err := app.Save(w.CheckTypeA); err == nil {
		t.Error("also_satisfies of another category accepted on update")
	}
}

func isDefault(t *testing.T, app core.App, id string) bool {
	t.Helper()
	record, err := app.FindRecordById("check_types", id)
	if err != nil {
		t.Fatal(err)
	}
	return record.GetBool("is_default")
}

func TestOneDefaultCheckTypePerCategory(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	first := testenv.Create(t, app, "check_types", map[string]any{"category": w.CategoryA.Id, "name": "Erste",
		"interval_months": 6, "is_default": true})
	w.CheckTypeB.Set("is_default", true)
	if err := app.Save(w.CheckTypeB); err != nil {
		t.Fatal(err)
	}

	w.CheckTypeA.Set("is_default", true)
	if err := app.Save(w.CheckTypeA); err != nil {
		t.Fatal(err)
	}
	if isDefault(t, app, first.Id) {
		t.Error("the previous default stayed after an update")
	}
	if !isDefault(t, app, w.CheckTypeA.Id) {
		t.Error("the new default was not stored")
	}
	if !isDefault(t, app, w.CheckTypeB.Id) {
		t.Error("another category lost its default")
	}

	created := testenv.Create(t, app, "check_types", map[string]any{"category": w.CategoryA.Id, "name": "Neu",
		"after_use": true, "is_default": true})
	if isDefault(t, app, w.CheckTypeA.Id) {
		t.Error("the previous default stayed after a create")
	}
	if !isDefault(t, app, created.Id) {
		t.Error("the created default was not stored")
	}
}

func TestSavingANonDefaultKeepsTheDefault(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	chosen := testenv.Create(t, app, "check_types", map[string]any{"category": w.CategoryA.Id, "name": "Standard",
		"interval_months": 6, "is_default": true})
	w.CheckTypeA.Set("name", "Umbenannt")
	if err := app.Save(w.CheckTypeA); err != nil {
		t.Fatal(err)
	}
	if !isDefault(t, app, chosen.Id) {
		t.Error("the default was lost")
	}
}

func TestEntriesCannotBeDatedInTheFuture(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	date := func(days int) string { return due.Today().AddDate(0, 0, days).Format("2006-01-02") }
	build := func(collection, date string) *core.Record {
		c, err := app.FindCollectionByNameOrId(collection)
		if err != nil {
			t.Fatal(err)
		}
		record := core.NewRecord(c)
		record.Load(map[string]any{"item": w.ItemA.Id, "date": date, "kind": "other", "created_by": w.Use.Id,
			"check_type": w.CheckTypeA.Id, "result": "passed", "performed_by": w.Check.Id})
		return record
	}
	for _, collection := range []string{"uses", "checks"} {
		if err := app.Save(build(collection, date(1))); err == nil {
			t.Errorf("%s: tomorrow accepted", collection)
		}
		if err := app.Save(build(collection, date(0))); err != nil {
			t.Errorf("%s: today rejected: %v", collection, err)
		}
	}
}

func authRequest(app *tests.TestApp, name, method, url, body, token string, status int, content ...string) tests.ApiScenario {
	if len(content) == 0 {
		content = []string{""}
	}
	headers := map[string]string{"Content-Type": "application/json"}
	if token != "" {
		headers["Authorization"] = token
	}
	return tests.ApiScenario{
		Name: name, Method: method, URL: url, Body: strings.NewReader(body), Headers: headers,
		ExpectedStatus: status, ExpectedContent: content,
		DisableTestAppCleanup: true,
		TestAppFactory:        func(testing.TB) *tests.TestApp { return app },
		BeforeTestFunc:        registerRoutes,
	}
}

func login(app *tests.TestApp, name, email, password string, status int) tests.ApiScenario {
	return authRequest(app, name, http.MethodPost, "/api/collections/users/auth-with-password",
		`{"identity":"`+email+`","password":"`+password+`"}`, "", status)
}

func deactivate(t *testing.T, app core.App, user *core.Record, value bool) {
	t.Helper()
	record, err := app.FindRecordById("users", user.Id)
	if err != nil {
		t.Fatal(err)
	}
	record.Set("deactivated", value)
	if err := app.Save(record); err != nil {
		t.Fatal(err)
	}
}

func TestDeactivatedUser(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	testenv.Create(t, app, "uses", map[string]any{"item": w.ItemA.Id, "date": "2026-10-01", "kind": "other", "created_by": w.Use.Id})
	testenv.Create(t, app, "checks", map[string]any{"item": w.ItemA.Id, "check_type": w.CheckTypeA.Id,
		"date": "2026-10-01", "result": "passed", "performed_by": w.Check.Id})
	useToken := testenv.Token(t, w.Use)

	s := login(app, "wrong password", "use@example.com", "wrong-password", 400)
	s.Test(t)
	s = login(app, "active login", "use@example.com", testenv.Password, 200)
	s.Test(t)

	deactivate(t, app, w.Use, true)
	deactivate(t, app, w.Check, true)

	s = login(app, "login fails like a wrong password", "use@example.com", testenv.Password, 400)
	s.ExpectedContent = []string{"Failed to authenticate."}
	s.Test(t)
	s = authRequest(app, "refresh fails", http.MethodPost, "/api/collections/users/auth-refresh", "", useToken, 401)
	s.Test(t)
	s = authRequest(app, "token no longer works", http.MethodGet, "/api/material/due", "", useToken, 401)
	s.Test(t)

	// History and permissions stay, and others still see the name.
	if n, err := app.CountRecords("uses"); err != nil || n != 1 {
		t.Errorf("uses = %d, err %v", n, err)
	}
	if n, err := app.CountRecords("checks"); err != nil || n != 1 {
		t.Errorf("checks = %d, err %v", n, err)
	}
	if n, err := app.CountRecords("permissions"); err != nil || n != 5 {
		t.Errorf("permissions = %d, err %v", n, err)
	}
	s = authRequest(app, "name stays in the history", http.MethodGet, "/api/collections/checks/records?expand=performed_by", "",
		testenv.Token(t, w.Manage), 200, `"name":"Check"`)
	s.Test(t)

	deactivate(t, app, w.Use, false)
	s = login(app, "reactivated login", "use@example.com", testenv.Password, 200)
	s.Test(t)
	reloaded, err := app.FindRecordById("users", w.Use.Id)
	if err != nil {
		t.Fatal(err)
	}
	s = authRequest(app, "same items after reactivation", http.MethodGet, "/api/material/due", "", testenv.Token(t, reloaded), 200, "Item A")
	s.Test(t)
}

func TestOtherUserChangesKeepTheToken(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	token := testenv.Token(t, w.Use)

	w.Use.Set("name", "Neuer Name")
	if err := app.Save(w.Use); err != nil {
		t.Fatal(err)
	}
	s := authRequest(app, "refresh", http.MethodPost, "/api/collections/users/auth-refresh", "", token, 200)
	s.Test(t)
}

// rejectedField returns the field an error from a save names, or "" for no error.
func rejectedField(t *testing.T, err error) string {
	t.Helper()
	if err == nil {
		return ""
	}
	var errs validation.Errors
	if !errors.As(err, &errs) || len(errs) != 1 {
		t.Fatalf("not a single validation error: %v", err)
	}
	for field := range errs {
		return field
	}
	return ""
}

func TestTimingsValidation(t *testing.T) {
	tests := []struct {
		name    string
		timings any
		ok      bool
	}{
		{"nil", nil, true},
		{"empty", `[]`, true},
		{"several", `[14, 3, 0]`, true},
		{"zero", `[0]`, true},
		{"far ahead", `[90]`, true},
		{"too long ahead", `[91]`, false},
		{"negative", `[-1]`, false},
		{"duplicate", `[3, 3]`, false},
		{"fraction", `[1.5]`, false},
		{"string element", `["3"]`, false},
		{"not a list", `"14"`, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := testenv.New(t)
			w := testenv.Seed(t, app)
			c, err := app.FindCollectionByNameOrId("notification_settings")
			if err != nil {
				t.Fatal(err)
			}
			record := core.NewRecord(c)
			record.Load(map[string]any{"user": w.Use.Id, "category": w.CategoryA.Id, "timings": tt.timings})
			got := rejectedField(t, app.Save(record))
			if tt.ok && got != "" {
				t.Errorf("rejected: %s", got)
			}
			if !tt.ok && got != "timings" {
				t.Errorf("rejected field = %q, want timings", got)
			}
		})
	}
}

func TestQuietTimeValidation(t *testing.T) {
	tests := []struct {
		from, until string
		ok          bool
	}{
		{"", "", true},
		{"22:00", "07:00", true},
		{"00:00", "23:59", true},
		{"22:00", "", false},
		{"", "07:00", false},
		{"7:00", "08:00", false},
		{"24:00", "07:00", false},
		{"22:60", "07:00", false},
		{"22:00", "22:00", false},
	}
	for _, tt := range tests {
		t.Run(tt.from+"-"+tt.until, func(t *testing.T) {
			app := testenv.New(t)
			w := testenv.Seed(t, app)
			c, err := app.FindCollectionByNameOrId("notification_preferences")
			if err != nil {
				t.Fatal(err)
			}
			record := core.NewRecord(c)
			record.Load(map[string]any{"user": w.Use.Id, "quiet_from": tt.from, "quiet_until": tt.until})
			got := rejectedField(t, app.Save(record))
			if tt.ok && got != "" {
				t.Errorf("rejected: %s", got)
			}
			if !tt.ok && got != "quiet_from" && got != "quiet_until" {
				t.Errorf("rejected field = %q, want quiet_from or quiet_until", got)
			}
		})
	}
}

func TestSubscriptionEndpointMustBeHTTPS(t *testing.T) {
	tests := []struct {
		endpoint string
		ok       bool
	}{
		{"https://push.example.com/1", true},
		{"http://push.example.com/1", false},
		{"ftp://x", false},
		{"not a url", false},
	}
	for _, tt := range tests {
		t.Run(tt.endpoint, func(t *testing.T) {
			app := testenv.New(t)
			w := testenv.Seed(t, app)
			c, err := app.FindCollectionByNameOrId("push_subscriptions")
			if err != nil {
				t.Fatal(err)
			}
			record := core.NewRecord(c)
			record.Load(map[string]any{"user": w.Use.Id, "endpoint": tt.endpoint})
			got := rejectedField(t, app.Save(record))
			if tt.ok && got != "" {
				t.Errorf("rejected: %s", got)
			}
			if !tt.ok && got != "endpoint" {
				t.Errorf("rejected field = %q, want endpoint", got)
			}
		})
	}
}
