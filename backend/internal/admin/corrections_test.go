package admin_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/admin"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

type correctionEnv struct {
	*routeEnv
	w     *testenv.World
	boss  *core.Record
	check func(item *core.Record, date, result string) *core.Record
}

func newCorrectionEnv(t *testing.T) *correctionEnv {
	e := newRouteEnv(t)
	w := testenv.Seed(t, e.app)
	c := &correctionEnv{routeEnv: e, w: w, boss: e.admin("boss@example.com", admin.Corrections)}
	c.check = func(item *core.Record, date, result string) *core.Record {
		return testenv.Create(t, e.app, "checks", map[string]any{"item": item.Id, "check_type": w.CheckTypeA.Id, "date": date, "result": result, "performed_by": w.Check.Id})
	}
	return c
}

func (c *correctionEnv) use(date string) *core.Record {
	return testenv.Create(c.t, c.app, "uses", map[string]any{"item": c.w.ItemA.Id, "date": date, "kind": "operation", "created_by": c.w.Use.Id, "note": "alt"})
}

func (c *correctionEnv) status() string {
	item, _ := c.app.FindRecordById("items", c.w.ItemA.Id)
	return item.GetString("status")
}

func corrections(t *testing.T, app core.App) []*core.Record {
	t.Helper()
	rows, err := app.FindAllRecords("corrections")
	if err != nil {
		t.Fatal(err)
	}
	return rows
}

func TestCorrectionsNeedTheCorrectionsRight(t *testing.T) {
	c := newCorrectionEnv(t)
	use := c.use("2026-10-01")
	members := c.admin("members@example.com", admin.Members)
	for _, call := range [][2]string{{http.MethodPatch, "/api/admin/uses/" + use.Id}, {http.MethodDelete, "/api/admin/uses/" + use.Id}} {
		if rec := c.do(nil, call[0], call[1], `{}`, nil); rec.Code != http.StatusUnauthorized {
			t.Errorf("anonymous %s: %d", call[0], rec.Code)
		}
		if rec := c.do(members, call[0], call[1], `{}`, nil); rec.Code != http.StatusForbidden {
			t.Errorf("members holder %s: %d", call[0], rec.Code)
		}
	}
	if _, err := c.app.FindRecordById("uses", use.Id); err != nil {
		t.Fatal("a refused call changed the use")
	}
}

func TestEditUseKeepsTheOldValuesInACorrection(t *testing.T) {
	c := newCorrectionEnv(t)
	use := c.use("2026-10-01")
	rec := c.do(c.boss, http.MethodPatch, "/api/admin/uses/"+use.Id, `{"date":"2026-10-02","kind":"exercise","recordedByName":"Neu","note":"neu"}`, nil)
	if rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	got, _ := c.app.FindRecordById("uses", use.Id)
	if got.GetString("kind") != "exercise" || got.GetString("note") != "neu" || got.GetString("recorded_by_name") != "Neu" || got.GetDateTime("date").Time().Format("2006-01-02") != "2026-10-02" {
		t.Fatalf("not applied: %v", got.PublicExport())
	}
	rows := corrections(t, c.app)
	if len(rows) != 1 || rows[0].GetString("action") != "edit" || rows[0].GetString("collection") != "uses" ||
		rows[0].GetString("record") != use.Id || rows[0].GetString("item") != c.w.ItemA.Id || rows[0].GetString("admin") != c.boss.Id {
		t.Fatalf("correction row: %v", rows)
	}
	for _, field := range []string{"before", "after"} {
		if rows[0].GetString(field) == "" {
			t.Errorf("%s is empty", field)
		}
	}
	if before := rows[0].GetString("before"); !strings.Contains(before, `"note":"alt"`) {
		t.Errorf("before lacks the old note: %s", before)
	}
}

func TestEditUseRefusesWhatItDoesNotKnow(t *testing.T) {
	c := newCorrectionEnv(t)
	use := c.use("2026-10-01")
	for _, body := range []string{`{"item":"x"}`, `{"createdBy":"x"}`, `{"kind":"nope"}`, `{"date":"2999-01-01"}`, `{"date":"not a date"}`} {
		if rec := c.do(c.boss, http.MethodPatch, "/api/admin/uses/"+use.Id, body, nil); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: %d", body, rec.Code)
		}
	}
	got, _ := c.app.FindRecordById("uses", use.Id)
	if got.GetString("note") != "alt" || got.GetString("item") != c.w.ItemA.Id || len(corrections(t, c.app)) != 0 {
		t.Fatal("a refused edit left a trace")
	}
	if rec := c.do(c.boss, http.MethodPatch, "/api/admin/uses/unknown", `{}`, nil); rec.Code != http.StatusNotFound {
		t.Errorf("unknown use: %d", rec.Code)
	}
}

func TestDeleteUse(t *testing.T) {
	c := newCorrectionEnv(t)
	use := c.use("2026-10-01")
	if rec := c.do(c.boss, http.MethodDelete, "/api/admin/uses/"+use.Id, "", nil); rec.Code != http.StatusNoContent {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	if _, err := c.app.FindRecordById("uses", use.Id); err == nil {
		t.Fatal("the use is still there")
	}
	rows := corrections(t, c.app)
	if len(rows) != 1 || rows[0].GetString("action") != "delete" {
		t.Fatalf("correction row: %v", rows)
	}
}

func TestEditCheckResultMovesTheItemStatus(t *testing.T) {
	c := newCorrectionEnv(t)
	defect := c.check(c.w.ItemA, "2026-10-01", "defect")
	if c.status() != "defective" {
		t.Fatalf("setup: %s", c.status())
	}
	if rec := c.do(c.boss, http.MethodPatch, "/api/admin/checks/"+defect.Id, `{"result":"passed","note":"war ein Irrtum"}`, nil); rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	if c.status() != "active" {
		t.Fatalf("the status must follow the corrected check: %s", c.status())
	}
	if rec := c.do(c.boss, http.MethodPatch, "/api/admin/checks/"+defect.Id, `{"result":"defect"}`, nil); rec.Code != 200 {
		t.Fatal(rec.Code)
	}
	if c.status() != "defective" {
		t.Fatalf("and back: %s", c.status())
	}
}

func TestEditCheckLeavesAStatusAloneThatNoCheckExplains(t *testing.T) {
	c := newCorrectionEnv(t)
	passed := c.check(c.w.ItemA, "2026-10-01", "passed")
	item, _ := c.app.FindRecordById("items", c.w.ItemA.Id)
	item.Set("status", "retired")
	if err := c.app.Save(item); err != nil {
		t.Fatal(err)
	}
	if rec := c.do(c.boss, http.MethodPatch, "/api/admin/checks/"+passed.Id, `{"note":"nur ein Tippfehler"}`, nil); rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	if c.status() != "retired" {
		t.Fatalf("a status set by hand must stay: %s", c.status())
	}
}

func TestDeleteCheckIsRefusedWhenItDecidesTheStatus(t *testing.T) {
	c := newCorrectionEnv(t)
	c.check(c.w.ItemA, "2026-09-01", "passed")
	defect := c.check(c.w.ItemA, "2026-10-01", "defect")
	rec := c.do(c.boss, http.MethodDelete, "/api/admin/checks/"+defect.Id, "", nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d %s", rec.Code, rec.Body)
	}
	if _, err := c.app.FindRecordById("checks", defect.Id); err != nil {
		t.Fatal("the check was deleted")
	}
	if c.status() != "defective" || len(corrections(t, c.app)) != 0 {
		t.Fatal("a refused delete left a trace")
	}
}

func TestDeleteCheckThatDoesNotDecideTheStatus(t *testing.T) {
	c := newCorrectionEnv(t)
	old := c.check(c.w.ItemA, "2026-09-01", "passed")
	c.check(c.w.ItemA, "2026-10-01", "passed")
	if rec := c.do(c.boss, http.MethodDelete, "/api/admin/checks/"+old.Id, "", nil); rec.Code != http.StatusNoContent {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	if c.status() != "active" || len(corrections(t, c.app)) != 1 {
		t.Fatalf("status %s, corrections %d", c.status(), len(corrections(t, c.app)))
	}
}

func TestOnlyCorrectionsHoldersReadCorrections(t *testing.T) {
	c := newCorrectionEnv(t)
	use := c.use("2026-10-01")
	c.do(c.boss, http.MethodPatch, "/api/admin/uses/"+use.Id, `{"note":"neu"}`, nil)
	if rec := c.do(c.boss, http.MethodGet, "/api/collections/corrections/records", "", nil); rec.Code != 200 || !strings.Contains(rec.Body.String(), use.Id) {
		t.Errorf("holder: %d %s", rec.Code, rec.Body)
	}
	if rec := c.do(c.w.Use, http.MethodGet, "/api/collections/corrections/records", "", nil); !strings.Contains(rec.Body.String(), `"totalItems":0`) {
		t.Errorf("plain user: %d %s", rec.Code, rec.Body)
	}
	if rec := c.do(c.boss, http.MethodPost, "/api/collections/corrections/records", `{}`, nil); rec.Code != http.StatusForbidden {
		t.Errorf("nobody writes through the API: %d", rec.Code)
	}
}
