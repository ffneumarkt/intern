package migrations_test

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

// rulesEnv runs API requests as the users of a seeded World.
type rulesEnv struct {
	app *tests.TestApp
	w   *testenv.World
}

func newRulesEnv(t *testing.T) *rulesEnv {
	app := testenv.New(t)
	return &rulesEnv{app: app, w: testenv.Seed(t, app)}
}

type request struct {
	as       *core.Record // nil means anonymous
	method   string
	url      string
	body     string
	status   int
	contains []string
	lacks    []string
}

func records(collection string) string {
	return "/api/collections/" + collection + "/records"
}

func record(collection, id string) string {
	return records(collection) + "/" + id
}

func (e *rulesEnv) run(t *testing.T, name string, r request) {
	t.Helper()
	headers := map[string]string{"Content-Type": "application/json"}
	if r.as != nil {
		headers["Authorization"] = testenv.Token(t, r.as)
	}
	contains := r.contains
	if len(contains) == 0 {
		contains = []string{""}
	}
	s := tests.ApiScenario{
		Name:                  name,
		Method:                r.method,
		URL:                   r.url,
		Body:                  strings.NewReader(r.body),
		Headers:               headers,
		ExpectedStatus:        r.status,
		ExpectedContent:       contains,
		NotExpectedContent:    r.lacks,
		DisableTestAppCleanup: true,
		TestAppFactory:        func(testing.TB) *tests.TestApp { return e.app },
	}
	if r.method == http.MethodDelete && r.status == 204 {
		s.ExpectedContent = nil
	}
	s.Test(t)
}

func useBody(item, user *core.Record) string {
	return fmt.Sprintf(`{"item":%q,"date":"2026-10-01","kind":"exercise","created_by":%q}`, item.Id, user.Id)
}

func checkBody(item, checkType, user *core.Record) string {
	return fmt.Sprintf(`{"item":%q,"check_type":%q,"date":"2026-10-01","result":"passed","performed_by":%q}`,
		item.Id, checkType.Id, user.Id)
}

func itemBody(category *core.Record) string {
	return fmt.Sprintf(`{"category":%q,"name":"Neu","status":"active"}`, category.Id)
}

func TestUserRules(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w

	e.run(t, "nobody registers", request{method: "POST", url: records("users"),
		body:   `{"email":"new@example.com","password":"password1234","passwordConfirm":"password1234"}`,
		status: 403})
	e.run(t, "no self delete", request{as: w.Use, method: "DELETE", url: record("users", w.Use.Id), status: 403})
	e.run(t, "own name changes", request{as: w.Use, method: "PATCH", url: record("users", w.Use.Id),
		body: `{"name":"Neu"}`, status: 200})
	e.run(t, "no self deactivation", request{as: w.Use, method: "PATCH", url: record("users", w.Use.Id),
		body: `{"deactivated":true}`, status: 404})
	e.run(t, "others' names are visible, not their email", request{as: w.Use, method: "GET",
		url: record("users", w.Check.Id), status: 200, contains: []string{`"name":"Check"`}, lacks: []string{"check@example.com"}})
	e.run(t, "users are not listed", request{as: w.Use, method: "GET", url: records("users"), status: 200,
		lacks: []string{`"name":"Check"`}})
	e.run(t, "anonymous sees no user", request{method: "GET", url: record("users", w.Check.Id), status: 404})
}

func TestNoPermissionSeesNothing(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w
	for _, collection := range []string{"categories", "items", "check_types", "uses", "checks", "permissions"} {
		for name, as := range map[string]*core.Record{"none": w.None, "anonymous": nil} {
			e.run(t, name+" lists no "+collection, request{as: as, method: "GET", url: records(collection),
				status: 200, contains: []string{`"totalItems":0`}})
		}
	}
	e.run(t, "item view", request{as: w.None, method: "GET", url: record("items", w.ItemA.Id), status: 404})
}

func TestUseLevel(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w

	e.run(t, "sees own category", request{as: w.Use, method: "GET", url: records("items"), status: 200,
		contains: []string{"Item A"}, lacks: []string{"Item B"}})
	e.run(t, "sees check types", request{as: w.Use, method: "GET", url: records("check_types"), status: 200,
		contains: []string{"Type A"}, lacks: []string{"Type B"}})
	e.run(t, "records a use", request{as: w.Use, method: "POST", url: records("uses"), body: useBody(w.ItemA, w.Use), status: 200})
	e.run(t, "no use in another category", request{as: w.Use, method: "POST", url: records("uses"), body: useBody(w.ItemB, w.Use), status: 400})
	e.run(t, "no use in another name", request{as: w.Use, method: "POST", url: records("uses"), body: useBody(w.ItemA, w.Check), status: 400})
	e.run(t, "no check", request{as: w.Use, method: "POST", url: records("checks"), body: checkBody(w.ItemA, w.CheckTypeA, w.Use), status: 400})
	e.run(t, "no item update", request{as: w.Use, method: "PATCH", url: record("items", w.ItemA.Id), body: `{"name":"x"}`, status: 404})
	e.run(t, "no retiring", request{as: w.Use, method: "PATCH", url: record("items", w.ItemA.Id), body: `{"status":"retired"}`, status: 404})
}

func TestCheckLevel(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w

	e.run(t, "records a check", request{as: w.Check, method: "POST", url: records("checks"), body: checkBody(w.ItemA, w.CheckTypeA, w.Check), status: 200})
	e.run(t, "records a use", request{as: w.Check, method: "POST", url: records("uses"), body: useBody(w.ItemA, w.Check), status: 200})
	e.run(t, "no check in another name", request{as: w.Check, method: "POST", url: records("checks"), body: checkBody(w.ItemA, w.CheckTypeA, w.Manage), status: 400})
	e.run(t, "no check type of another category", request{as: w.Check, method: "POST", url: records("checks"), body: checkBody(w.ItemA, w.CheckTypeB, w.Check), status: 400})
	e.run(t, "no item create", request{as: w.Check, method: "POST", url: records("items"), body: itemBody(w.CategoryA), status: 400})
	e.run(t, "no rename", request{as: w.Check, method: "PATCH", url: record("items", w.ItemA.Id), body: `{"name":"x"}`, status: 404})
	e.run(t, "no retire and rename", request{as: w.Check, method: "PATCH", url: record("items", w.ItemA.Id), body: `{"status":"retired","name":"x"}`, status: 404})
	e.run(t, "no setting defective", request{as: w.Check, method: "PATCH", url: record("items", w.ItemA.Id), body: `{"status":"defective"}`, status: 404})
	e.run(t, "retires", request{as: w.Check, method: "PATCH", url: record("items", w.ItemA.Id), body: `{"status":"retired"}`, status: 200})
}

func TestManageLevel(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w

	e.run(t, "creates an item", request{as: w.Manage, method: "POST", url: records("items"), body: itemBody(w.CategoryA), status: 200})
	e.run(t, "no defective item", request{as: w.Manage, method: "POST", url: records("items"),
		body: fmt.Sprintf(`{"category":%q,"name":"x","status":"defective"}`, w.CategoryA.Id), status: 400})
	e.run(t, "renames", request{as: w.Manage, method: "PATCH", url: record("items", w.ItemA.Id), body: `{"name":"Umbenannt"}`, status: 200})
	e.run(t, "no moving", request{as: w.Manage, method: "PATCH", url: record("items", w.ItemA.Id),
		body: fmt.Sprintf(`{"category":%q}`, w.CategoryB.Id), status: 404})
	e.run(t, "no setting defective", request{as: w.Manage, method: "PATCH", url: record("items", w.ItemA.Id), body: `{"status":"defective"}`, status: 404})

	e.run(t, "creates a check type", request{as: w.Manage, method: "POST", url: records("check_types"),
		body: fmt.Sprintf(`{"category":%q,"name":"Neu","interval_months":6}`, w.CategoryA.Id), status: 200})
	e.run(t, "no check type elsewhere", request{as: w.Manage, method: "POST", url: records("check_types"),
		body: fmt.Sprintf(`{"category":%q,"name":"Neu","interval_months":6}`, w.CategoryB.Id), status: 400})
	e.run(t, "renames a check type", request{as: w.Manage, method: "PATCH", url: record("check_types", w.CheckTypeA.Id), body: `{"name":"x"}`, status: 200})
	e.run(t, "no moving a check type", request{as: w.Manage, method: "PATCH", url: record("check_types", w.CheckTypeA.Id),
		body: fmt.Sprintf(`{"category":%q}`, w.CategoryB.Id), status: 404})
	e.run(t, "sets the default", request{as: w.Manage, method: "PATCH", url: record("check_types", w.CheckTypeA.Id), body: `{"is_default":true}`,
		status: 200, contains: []string{`"is_default":true`}})
	e.run(t, "deletes a check type", request{as: w.Manage, method: "DELETE", url: record("check_types", w.CheckTypeA.Id), status: 204})
	testenv.Create(t, e.app, "uses", map[string]any{"item": w.ItemA.Id, "date": "2026-10-01", "kind": "other", "created_by": w.Manage.Id})
	e.run(t, "no delete with history", request{as: w.Manage, method: "DELETE", url: record("items", w.ItemA.Id), status: 400})
	e.run(t, "retires instead", request{as: w.Manage, method: "PATCH", url: record("items", w.ItemA.Id), body: `{"status":"retired"}`, status: 200})
	fresh := testenv.Create(t, e.app, "items", map[string]any{"category": w.CategoryA.Id, "name": "Frisch", "status": "active"})
	e.run(t, "deletes an item without history", request{as: w.Manage, method: "DELETE", url: record("items", fresh.Id), status: 204})
	e.run(t, "no delete elsewhere", request{as: w.Manage, method: "DELETE", url: record("items", w.ItemB.Id), status: 404})

	for _, collection := range []string{"categories", "permissions"} {
		e.run(t, "no create in "+collection, request{as: w.Manage, method: "POST", url: records(collection), body: `{}`, status: 403})
	}
}

func TestMixedLevelsDoNotLeakBetweenCategories(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w

	e.run(t, "manage in B", request{as: w.Mixed, method: "POST", url: records("items"), body: itemBody(w.CategoryB), status: 200})
	e.run(t, "use in A only", request{as: w.Mixed, method: "POST", url: records("items"), body: itemBody(w.CategoryA), status: 400})
	e.run(t, "no update in A", request{as: w.Mixed, method: "PATCH", url: record("items", w.ItemA.Id), body: `{"name":"x"}`, status: 404})
	e.run(t, "no delete in A", request{as: w.Mixed, method: "DELETE", url: record("items", w.ItemA.Id), status: 404})
	e.run(t, "no check in A", request{as: w.Mixed, method: "POST", url: records("checks"), body: checkBody(w.ItemA, w.CheckTypeA, w.Mixed), status: 400})
	e.run(t, "check in B", request{as: w.Mixed, method: "POST", url: records("checks"), body: checkBody(w.ItemB, w.CheckTypeB, w.Mixed), status: 200})
}

func TestRetiredItemsTakeNoEntries(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w
	w.ItemA.Set("status", "retired")
	if err := e.app.Save(w.ItemA); err != nil {
		t.Fatal(err)
	}
	e.run(t, "no use", request{as: w.Manage, method: "POST", url: records("uses"), body: useBody(w.ItemA, w.Manage), status: 400})
	e.run(t, "no check", request{as: w.Manage, method: "POST", url: records("checks"), body: checkBody(w.ItemA, w.CheckTypeA, w.Manage), status: 400})
}

func TestHistoryIsImmutable(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w
	use := testenv.Create(t, e.app, "uses", map[string]any{"item": w.ItemA.Id, "date": "2026-10-01", "kind": "other", "created_by": w.Manage.Id})
	check := testenv.Create(t, e.app, "checks", map[string]any{"item": w.ItemA.Id, "check_type": w.CheckTypeA.Id,
		"date": "2026-10-01", "result": "passed", "performed_by": w.Manage.Id})
	for collection, id := range map[string]string{"uses": use.Id, "checks": check.Id} {
		e.run(t, collection+" update", request{as: w.Manage, method: "PATCH", url: record(collection, id), body: `{"note":"x"}`, status: 403})
		e.run(t, collection+" delete", request{as: w.Manage, method: "DELETE", url: record(collection, id), status: 403})
	}
}

func TestPermissionsAreOwnOnly(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w
	e.run(t, "own permission only", request{as: w.Use, method: "GET", url: records("permissions"), status: 200,
		contains: []string{w.Use.Id, `"totalItems":1`}, lacks: []string{w.Check.Id}})
}

func TestNotificationSettingsAreOwnOnly(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w
	theirs := testenv.Create(t, e.app, "notification_settings", map[string]any{"user": w.Check.Id, "category": w.CategoryA.Id})
	body := func(user *core.Record) string {
		return fmt.Sprintf(`{"user":%q,"category":%q}`, user.Id, w.CategoryA.Id)
	}
	e.run(t, "creates own", request{as: w.Use, method: "POST", url: records("notification_settings"), body: body(w.Use), status: 200})
	e.run(t, "not for others", request{as: w.Manage, method: "POST", url: records("notification_settings"), body: body(w.Use), status: 400})
	e.run(t, "not reading others", request{as: w.Use, method: "GET", url: record("notification_settings", theirs.Id), status: 404})
	e.run(t, "owner updates", request{as: w.Check, method: "PATCH", url: record("notification_settings", theirs.Id), body: `{"weekly_overdue":true}`, status: 200})
	e.run(t, "owner cannot reassign", request{as: w.Check, method: "PATCH", url: record("notification_settings", theirs.Id),
		body: fmt.Sprintf(`{"user":%q}`, w.Use.Id), status: 404})
	e.run(t, "owner deletes", request{as: w.Check, method: "DELETE", url: record("notification_settings", theirs.Id), status: 204})
}

func TestNotificationPreferencesRules(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w
	theirs := testenv.Create(t, e.app, "notification_preferences", map[string]any{"user": w.Check.Id})
	body := func(user *core.Record) string { return fmt.Sprintf(`{"user":%q}`, user.Id) }
	e.run(t, "creates own", request{as: w.Use, method: "POST", url: records("notification_preferences"), body: body(w.Use), status: 200})
	e.run(t, "not for others", request{as: w.Manage, method: "POST", url: records("notification_preferences"), body: body(w.Use), status: 400})
	e.run(t, "not reading others", request{as: w.Use, method: "GET", url: record("notification_preferences", theirs.Id), status: 404})
	e.run(t, "owner updates", request{as: w.Check, method: "PATCH", url: record("notification_preferences", theirs.Id),
		body: `{"quiet_from":"22:00","quiet_until":"07:00"}`, status: 200})
	e.run(t, "owner cannot reassign", request{as: w.Check, method: "PATCH", url: record("notification_preferences", theirs.Id),
		body: fmt.Sprintf(`{"user":%q}`, w.Use.Id), status: 404})
	e.run(t, "owner deletes", request{as: w.Check, method: "DELETE", url: record("notification_preferences", theirs.Id), status: 204})
}

func TestPushSubscriptionsAreOwnOnly(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w
	e.run(t, "creates own", request{as: w.Use, method: "POST", url: records("push_subscriptions"),
		body: fmt.Sprintf(`{"user":%q,"endpoint":"https://push.example.com/a"}`, w.Use.Id), status: 200})
	e.run(t, "not for others", request{as: w.Manage, method: "POST", url: records("push_subscriptions"),
		body: fmt.Sprintf(`{"user":%q,"endpoint":"https://push.example.com/b"}`, w.Use.Id), status: 400})
}

func TestPasskeysCanOnlyBeRenamedOrRemoved(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w
	key := testenv.Create(t, e.app, "passkeys", map[string]any{"user": w.Use.Id, "credential_id": "c", "public_key": "k", "name": "Telefon"})
	e.run(t, "no create through the API", request{as: w.Use, method: "POST", url: records("passkeys"),
		body: fmt.Sprintf(`{"user":%q,"credential_id":"d","public_key":"k","name":"x"}`, w.Use.Id), status: 403})
	e.run(t, "renames", request{as: w.Use, method: "PATCH", url: record("passkeys", key.Id), body: `{"name":"Laptop"}`, status: 200})
	e.run(t, "no key change", request{as: w.Use, method: "PATCH", url: record("passkeys", key.Id), body: `{"public_key":"evil"}`, status: 404})
	e.run(t, "no backup eligible change", request{as: w.Use, method: "PATCH", url: record("passkeys", key.Id), body: `{"backup_eligible":true}`, status: 404})
	e.run(t, "no backup state change", request{as: w.Use, method: "PATCH", url: record("passkeys", key.Id), body: `{"backup_state":true}`, status: 404})
	e.run(t, "not others'", request{as: w.Check, method: "GET", url: record("passkeys", key.Id), status: 404})
	e.run(t, "removes", request{as: w.Use, method: "DELETE", url: record("passkeys", key.Id), status: 204})
}

func TestNotificationLogIsClosed(t *testing.T) {
	e := newRulesEnv(t)
	e.run(t, "list", request{as: e.w.Manage, method: "GET", url: records("notification_log"), status: 403})
}

func TestTransportDocumentSettingsArePublicToRead(t *testing.T) {
	e := newRulesEnv(t)
	e.run(t, "anonymous list", request{method: "GET", url: records("transport_document_settings"), status: 200})
	e.run(t, "no write", request{as: e.w.Manage, method: "POST", url: records("transport_document_settings"), body: `{}`, status: 403})
}

func TestMigrationsRevert(t *testing.T) {
	app := testenv.New(t)
	if _, err := core.NewMigrationsRunner(app, core.AppMigrations).Down(9); err != nil {
		t.Fatal(err)
	}
	if _, err := app.FindCollectionByNameOrId("items"); err == nil {
		t.Error("items still exists")
	}
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	if users.Fields.GetByName("deactivated") != nil {
		t.Error("deactivated still exists")
	}
}
