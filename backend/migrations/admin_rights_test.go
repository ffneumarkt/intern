package migrations_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/ffneumarkt/intern/backend/internal/admin"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

func TestAreas(t *testing.T) {
	if !admin.Valid("members") || admin.Valid("x") {
		t.Fatal("Valid must accept the four areas and nothing else")
	}
	if len(admin.Areas) != 4 {
		t.Fatalf("want 4 areas, got %v", admin.Areas)
	}
}

func TestAdminRightsRules(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w
	holder := testenv.Admin(t, e.app, testenv.User(t, e.app, "holder@example.com", "Holder"), admin.Members)
	other := testenv.Admin(t, e.app, testenv.User(t, e.app, "other@example.com", "Other"), admin.Categories)

	e.run(t, "holder lists all rows", request{as: holder, method: "GET", url: records("admin_rights"), status: 200, contains: []string{`"totalItems":2`}})
	e.run(t, "other lists only the own row", request{as: other, method: "GET", url: records("admin_rights"), status: 200, contains: []string{`"totalItems":1`}})
	e.run(t, "a plain user lists none", request{as: w.Use, method: "GET", url: records("admin_rights"), status: 200, contains: []string{`"totalItems":0`}})
	e.run(t, "anonymous lists none", request{method: "GET", url: records("admin_rights"), status: 200, contains: []string{`"totalItems":0`}})

	body := fmt.Sprintf(`{"user":%q,"area":"transport"}`, w.Use.Id)
	e.run(t, "other cannot grant", request{as: other, method: "POST", url: records("admin_rights"), body: body, status: 400})
	e.run(t, "holder grants", request{as: holder, method: "POST", url: records("admin_rights"), body: body, status: 200, contains: []string{`"area":"transport"`}})

	rows, err := e.app.FindRecordsByFilter("admin_rights", "user = {:u}", "", 0, 0, map[string]any{"u": w.Use.Id})
	if err != nil || len(rows) != 1 {
		t.Fatalf("granted row: %v %v", rows, err)
	}
	e.run(t, "nobody updates a row", request{as: holder, method: "PATCH", url: record("admin_rights", rows[0].Id), body: `{"area":"members"}`, status: 403})
	e.run(t, "holder revokes", request{as: holder, method: "DELETE", url: record("admin_rights", rows[0].Id), status: http.StatusNoContent})
}

func TestAdminRightsRejectBadInput(t *testing.T) {
	e := newRulesEnv(t)
	holder := testenv.Admin(t, e.app, testenv.User(t, e.app, "holder@example.com", "Holder"), admin.Members)
	e.run(t, "unknown area", request{as: holder, method: "POST", url: records("admin_rights"),
		body: fmt.Sprintf(`{"user":%q,"area":"nope"}`, holder.Id), status: 400})
	e.run(t, "duplicate", request{as: holder, method: "POST", url: records("admin_rights"),
		body: fmt.Sprintf(`{"user":%q,"area":"members"}`, holder.Id), status: 400})
}
