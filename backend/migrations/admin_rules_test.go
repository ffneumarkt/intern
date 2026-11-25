package migrations_test

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

type holders struct{ members, categories, transport *core.Record }

func newHolders(t *testing.T, e *rulesEnv) holders {
	return holders{
		members:    testenv.Admin(t, e.app, testenv.User(t, e.app, "m@example.com", "M"), admin.Members),
		categories: testenv.Admin(t, e.app, testenv.User(t, e.app, "c@example.com", "C"), admin.Categories),
		transport:  testenv.Admin(t, e.app, testenv.User(t, e.app, "t@example.com", "T"), admin.Transport),
	}
}

func TestMembersRules(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w
	h := newHolders(t, e)
	body := fmt.Sprintf(`{"user":%q,"category":%q,"level":"check"}`, w.None.Id, w.CategoryB.Id)

	e.run(t, "categories holder cannot grant", request{as: h.categories, method: "POST", url: records("permissions"), body: body, status: 400})
	e.run(t, "members holder grants", request{as: h.members, method: "POST", url: records("permissions"), body: body, status: 200, contains: []string{`"level":"check"`}})
	e.run(t, "members holder lists all", request{as: h.members, method: "GET", url: records("permissions"), status: 200, contains: []string{w.Use.Id, w.None.Id}})
	e.run(t, "a plain user still sees only the own", request{as: w.Use, method: "GET", url: records("permissions"), status: 200, lacks: []string{w.Check.Id}})

	row, err := e.app.FindFirstRecordByFilter("permissions", "user = {:u} && category = {:c}", map[string]any{"u": w.None.Id, "c": w.CategoryB.Id})
	if err != nil {
		t.Fatal(err)
	}
	e.run(t, "members holder changes the level", request{as: h.members, method: "PATCH", url: record("permissions", row.Id), body: `{"level":"manage"}`, status: 200})
	e.run(t, "members holder removes it", request{as: h.members, method: "DELETE", url: record("permissions", row.Id), status: http.StatusNoContent})

	e.run(t, "users stay closed: no create", request{as: h.members, method: "POST", url: records("users"),
		body: `{"email":"x@example.com","password":"password1234","passwordConfirm":"password1234"}`, status: 403})
	e.run(t, "users stay closed: no delete", request{as: h.members, method: "DELETE", url: record("users", w.Use.Id), status: 403})
}

func TestDeactivatedMembersHolderTokenStops(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w
	h := newHolders(t, e)
	// The guard keeps the last members holder active, so a second one has to exist.
	testenv.Admin(t, e.app, testenv.User(t, e.app, "m2@example.com", "M2"), admin.Members)
	old := testenv.Token(t, h.members)
	h.members.Set("deactivated", true)
	if err := e.app.Save(h.members); err != nil {
		t.Fatal(err)
	}
	(&tests.ApiScenario{
		Name: "old token", Method: "POST", URL: records("permissions"),
		Body:    strings.NewReader(fmt.Sprintf(`{"user":%q,"category":%q,"level":"use"}`, w.None.Id, w.CategoryB.Id)),
		Headers: map[string]string{"Content-Type": "application/json", "Authorization": old},
		// An unauthenticated create fails the rule.
		ExpectedStatus: 400, ExpectedContent: []string{""}, DisableTestAppCleanup: true,
		TestAppFactory: func(testing.TB) *tests.TestApp { return e.app },
	}).Test(t)
}

func TestCategoriesRules(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w
	h := newHolders(t, e)

	e.run(t, "categories holder lists all without a permission", request{as: h.categories, method: "GET", url: records("categories"), status: 200, contains: []string{`"totalItems":2`}})
	e.run(t, "but sees no items", request{as: h.categories, method: "GET", url: records("items"), status: 200, contains: []string{`"totalItems":0`}})
	e.run(t, "creates", request{as: h.categories, method: "POST", url: records("categories"), body: `{"name":"Neu"}`, status: 200})
	e.run(t, "updates", request{as: h.categories, method: "PATCH", url: record("categories", w.CategoryA.Id), body: `{"name":"A2"}`, status: 200})
	e.run(t, "members holder cannot create", request{as: h.members, method: "POST", url: records("categories"), body: `{"name":"X"}`, status: 400})
	e.run(t, "a plain user cannot create", request{as: w.Manage, method: "POST", url: records("categories"), body: `{"name":"X"}`, status: 400})
}

func TestTransportRules(t *testing.T) {
	e := newRulesEnv(t)
	h := newHolders(t, e)
	settings, err := e.app.FindFirstRecordByFilter("transport_document_settings", "id != ''")
	if err != nil {
		t.Fatal(err)
	}
	e.run(t, "transport holder writes", request{as: h.transport, method: "PATCH", url: record("transport_document_settings", settings.Id), body: `{"cylinder_label":"X"}`, status: 200})
	e.run(t, "categories holder cannot", request{as: h.categories, method: "PATCH", url: record("transport_document_settings", settings.Id), body: `{"cylinder_label":"Y"}`, status: 404})
	e.run(t, "anonymous still reads", request{method: "GET", url: records("transport_document_settings"), status: 200})
}
