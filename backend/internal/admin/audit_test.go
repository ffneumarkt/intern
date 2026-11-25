package admin_test

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/ffneumarkt/intern/backend/internal/admin"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

type call struct {
	as     *core.Record
	method string
	url    string
	body   string
	status int
	has    string
}

func do(t *testing.T, app *tests.TestApp, c call) {
	t.Helper()
	headers := map[string]string{"Content-Type": "application/json"}
	if c.as != nil {
		headers["Authorization"] = testenv.Token(t, c.as)
	}
	(&tests.ApiScenario{
		Method: c.method, URL: c.url, Body: strings.NewReader(c.body), Headers: headers,
		ExpectedStatus: c.status, ExpectedContent: []string{c.has}, DisableTestAppCleanup: true,
		TestAppFactory: func(testing.TB) *tests.TestApp { return app },
	}).Test(t)
}

func auditRows(t *testing.T, app core.App) []*core.Record {
	t.Helper()
	rows, err := app.FindAllRecords("admin_audit")
	if err != nil {
		t.Fatal(err)
	}
	return rows
}

func TestChangesAreAudited(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	members := testenv.Admin(t, app, testenv.User(t, app, "m@example.com", "M"), admin.Members)
	cats := testenv.Admin(t, app, testenv.User(t, app, "c@example.com", "C"), admin.Categories)

	grant := fmt.Sprintf(`{"user":%q,"category":%q,"level":"use"}`, w.None.Id, w.CategoryB.Id)
	do(t, app, call{members, "POST", "/api/collections/permissions/records", grant, http.StatusOK, ""})
	row, err := app.FindFirstRecordByFilter("permissions", "user = {:u}", map[string]any{"u": w.None.Id})
	if err != nil {
		t.Fatal(err)
	}
	do(t, app, call{members, "PATCH", "/api/collections/permissions/records/" + row.Id, `{"level":"check"}`, http.StatusOK, ""})
	do(t, app, call{members, "DELETE", "/api/collections/permissions/records/" + row.Id, "", http.StatusNoContent, ""})
	do(t, app, call{cats, "POST", "/api/collections/categories/records", `{"name":"Neu"}`, http.StatusOK, ""})

	rows := auditRows(t, app)
	if len(rows) != 4 {
		t.Fatalf("want 4 audit rows, got %d", len(rows))
	}
	want := []struct{ admin, action, collection string }{
		{members.Id, "create", "permissions"}, {members.Id, "update", "permissions"},
		{members.Id, "delete", "permissions"}, {cats.Id, "create", "categories"},
	}
	for i, r := range rows {
		if r.GetString("admin") != want[i].admin || r.GetString("action") != want[i].action || r.GetString("collection") != want[i].collection {
			t.Errorf("row %d: %s %s %s", i, r.GetString("admin"), r.GetString("action"), r.GetString("collection"))
		}
	}
	if !strings.Contains(rows[1].GetString("summary"), `"level":"check"`) {
		t.Errorf("update summary lacks the new level: %s", rows[1].GetString("summary"))
	}
}

func TestRejectedChangeIsNotAudited(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	do(t, app, call{w.Manage, "POST", "/api/collections/permissions/records",
		fmt.Sprintf(`{"user":%q,"category":%q,"level":"manage"}`, w.Manage.Id, w.CategoryB.Id), http.StatusBadRequest, ""})
	if n := len(auditRows(t, app)); n != 0 {
		t.Fatalf("want no audit rows, got %d", n)
	}
}

func TestAuditIsReadableByMembersOnly(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	members := testenv.Admin(t, app, testenv.User(t, app, "m@example.com", "M"), admin.Members)
	testenv.Create(t, app, "admin_audit", map[string]any{"admin": members.Id, "action": "create", "collection": "categories", "record": "x"})
	// An empty list for others, the row for a members holder; nobody writes through the API.
	do(t, app, call{members, "GET", "/api/collections/admin_audit/records", "", http.StatusOK, `"totalItems":1`})
	do(t, app, call{w.Use, "GET", "/api/collections/admin_audit/records", "", http.StatusOK, `"totalItems":0`})
	do(t, app, call{members, "POST", "/api/collections/admin_audit/records",
		fmt.Sprintf(`{"admin":%q,"action":"create","collection":"x","record":"y"}`, members.Id), http.StatusForbidden, ""})
}
