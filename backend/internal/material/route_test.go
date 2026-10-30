package material_test

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/ffneumarkt/intern/backend/internal/material"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

func registerRoutes(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
	material.RegisterRoutes(e, func() time.Time { return time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC) })
}

type dueCase struct {
	name     string
	query    string
	as       *core.Record
	status   int
	contains []string
	lacks    []string
	after    func(t testing.TB, app *tests.TestApp, res *http.Response)
}

func runDue(t *testing.T, app *tests.TestApp, c dueCase) {
	t.Helper()
	headers := map[string]string{}
	if c.as != nil {
		headers["Authorization"] = testenv.Token(t, c.as)
	}
	s := tests.ApiScenario{
		Name: c.name, Method: "GET", URL: "/api/material/due" + c.query, Headers: headers,
		ExpectedStatus: c.status, ExpectedContent: c.contains, NotExpectedContent: c.lacks,
		DisableTestAppCleanup: true,
		TestAppFactory:        func(testing.TB) *tests.TestApp { return app },
		BeforeTestFunc:        registerRoutes,
		AfterTestFunc:         c.after,
	}
	if len(s.ExpectedContent) == 0 {
		s.ExpectedContent = []string{""}
	}
	s.Test(t)
}

func setCreated(t *testing.T, app core.App, id, instant string) {
	t.Helper()
	_, err := app.DB().Update("items", dbx.Params{"created": instant}, dbx.HashExp{"id": id}).Execute()
	if err != nil {
		t.Fatal(err)
	}
}

func TestDueRouteAccess(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)

	runDue(t, app, dueCase{name: "anonymous", status: 401})
	runDue(t, app, dueCase{name: "use sees own category", as: w.Use, status: 200,
		contains: []string{`"name":"Item A"`, `"categoryId":"` + w.CategoryA.Id + `"`}, lacks: []string{"Item B"}})
	runDue(t, app, dueCase{name: "category filter", as: w.Mixed, query: "?category=" + w.CategoryA.Id, status: 200,
		contains: []string{"Item A"}, lacks: []string{"Item B"}})
	runDue(t, app, dueCase{name: "forbidden category", as: w.Use, query: "?category=" + w.CategoryB.Id, status: 403})
	runDue(t, app, dueCase{name: "unknown category", as: w.Use, query: "?category=nope", status: 403})
	runDue(t, app, dueCase{name: "mixed sees both", as: w.Mixed, status: 200, contains: []string{"Item A", "Item B"}})
	runDue(t, app, dueCase{name: "no permission is an empty list", as: w.None, status: 200, contains: []string{`{"items":[]}`}})
}

func TestDueRouteComputesDues(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	testenv.Create(t, app, "checks", map[string]any{"item": w.ItemA.Id, "check_type": w.CheckTypeA.Id,
		"date": "2025-10-21", "result": "passed", "performed_by": w.Check.Id})

	runDue(t, app, dueCase{name: "check due", as: w.Use, status: 200, contains: []string{
		`"state":"overdue"`,
		`"dues":[{"kind":"check","checkTypeId":"` + w.CheckTypeA.Id + `","date":"2026-10-21","state":"overdue"}]`,
	}})
}

func TestDueRouteUsesCreationDayInVienna(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	setCreated(t, app, w.ItemA.Id, "2026-10-29 23:30:00.000Z")

	runDue(t, app, dueCase{name: "next day in Vienna", as: w.Use, status: 200, contains: []string{
		`"date":"2026-10-30","state":"dueToday"`,
	}})
}

func TestDueRouteCountsUses(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	w.CheckTypeA.Set("after_use", true)
	if err := app.Save(w.CheckTypeA); err != nil {
		t.Fatal(err)
	}
	testenv.Create(t, app, "checks", map[string]any{"item": w.ItemA.Id, "check_type": w.CheckTypeA.Id,
		"date": "2026-10-01", "result": "passed", "performed_by": w.Check.Id})
	testenv.Create(t, app, "uses", map[string]any{"item": w.ItemA.Id, "date": "2026-10-20", "kind": "other", "created_by": w.Use.Id})

	runDue(t, app, dueCase{name: "after use", as: w.Use, status: 200, contains: []string{`"date":"2026-10-20"`}})
}

func TestDueRoutePassesCategoryAndAlsoSatisfies(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	w.CategoryA.Set("max_service_life_years", 10)
	if err := app.Save(w.CategoryA); err != nil {
		t.Fatal(err)
	}
	w.ItemA.Set("manufactured_on", "2016-03-01")
	if err := app.Save(w.ItemA); err != nil {
		t.Fatal(err)
	}
	major := testenv.Create(t, app, "check_types", map[string]any{"category": w.CategoryA.Id, "name": "Major",
		"interval_months": 60, "also_satisfies": []string{w.CheckTypeA.Id}})
	testenv.Create(t, app, "checks", map[string]any{"item": w.ItemA.Id, "check_type": major.Id,
		"date": "2026-06-01", "result": "passed", "performed_by": w.Check.Id})

	runDue(t, app, dueCase{name: "both reach the calculation", as: w.Use, status: 200, contains: []string{
		`"manufacturedOn":"2016-03-01"`,
		`"kind":"endOfLife","date":"2026-03-01","state":"overdue"`,
		`"checkTypeId":"` + w.CheckTypeA.Id + `","date":"2027-06-01"`,
	}})
}

func TestDueRouteKeepsRetiredItems(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	w.ItemA.Set("status", "retired")
	if err := app.Save(w.ItemA); err != nil {
		t.Fatal(err)
	}
	runDue(t, app, dueCase{name: "retired", as: w.Use, status: 200, contains: []string{
		`"status":"retired","state":"ok","dues":[]`,
	}})
}

func TestDueRouteSortsItemsByName(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	testenv.Create(t, app, "items", map[string]any{"category": w.CategoryA.Id, "name": "Aaa", "status": "active"})
	runDue(t, app, dueCase{name: "sorted", as: w.Use, status: 200, after: func(t testing.TB, _ *tests.TestApp, res *http.Response) {
		var body struct {
			Items []struct{ Name string }
		}
		if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if len(body.Items) != 2 || body.Items[0].Name != "Aaa" || body.Items[1].Name != "Item A" {
			t.Errorf("items = %+v", body.Items)
		}
	}})
}
