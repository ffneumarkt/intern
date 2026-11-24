package material_test

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

func defaultLocation(t *testing.T, app core.App) *core.Record {
	t.Helper()
	records, err := app.FindAllRecords("locations")
	if err != nil {
		t.Fatal(err)
	}
	for _, r := range records {
		if r.GetBool("is_default") {
			return r
		}
	}
	t.Fatal("no default location")
	return nil
}

func locationOf(t *testing.T, app core.App, collection, id string) string {
	t.Helper()
	r, err := app.FindRecordById(collection, id)
	if err != nil {
		t.Fatal(err)
	}
	return r.GetString("location")
}

func newLocation(t *testing.T, app core.App, name string) *core.Record {
	t.Helper()
	return testenv.Create(t, app, "locations", map[string]any{"name": name})
}

func TestMigrationCreatesTheWorkshopAsDefault(t *testing.T) {
	app := testenv.New(t)
	def := defaultLocation(t, app)
	if def.GetString("name") != "AS-Werkstatt" {
		t.Errorf("default location = %q, want AS-Werkstatt", def.GetString("name"))
	}
}

func TestUseMovesTheItemToTheDefaultLocation(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	rlf := newLocation(t, app, "RLF")
	w.ItemA.Set("location", rlf.Id)
	if err := app.Save(w.ItemA); err != nil {
		t.Fatal(err)
	}

	use := testenv.Create(t, app, "uses", map[string]any{"item": w.ItemA.Id, "date": "2026-10-01", "kind": "operation", "created_by": w.Use.Id})

	def := defaultLocation(t, app)
	if got := locationOf(t, app, "items", w.ItemA.Id); got != def.Id {
		t.Errorf("item location = %s, want the default %s", got, def.Id)
	}
	if got := locationOf(t, app, "uses", use.Id); got != def.Id {
		t.Errorf("use location = %s, want the default %s", got, def.Id)
	}
}

func TestCheckWithALocationMovesTheItem(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	last := newLocation(t, app, "LAST")

	check := testenv.Create(t, app, "checks", map[string]any{"item": w.ItemA.Id, "check_type": w.CheckTypeA.Id,
		"date": "2026-10-01", "result": "passed", "performed_by": w.Check.Id, "location": last.Id})

	if got := locationOf(t, app, "items", w.ItemA.Id); got != last.Id {
		t.Errorf("item location = %s, want %s", got, last.Id)
	}
	if got := locationOf(t, app, "checks", check.Id); got != last.Id {
		t.Errorf("check location = %s, want %s", got, last.Id)
	}
}

func TestCheckWithoutALocationKeepsTheItemAndRecordsWhereItWas(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	rlf := newLocation(t, app, "RLF")
	w.ItemA.Set("location", rlf.Id)
	if err := app.Save(w.ItemA); err != nil {
		t.Fatal(err)
	}

	check := addCheck(t, app, w, "defect")

	if got := locationOf(t, app, "items", w.ItemA.Id); got != rlf.Id {
		t.Errorf("item location = %s, want it unchanged at %s", got, rlf.Id)
	}
	if got := locationOf(t, app, "checks", check.Id); got != rlf.Id {
		t.Errorf("check location = %s, want where the item was, %s", got, rlf.Id)
	}
}

func TestOnlyUnusedNonDefaultLocationsCanBeDeleted(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	def := defaultLocation(t, app)
	rlf := newLocation(t, app, "RLF")
	spare := newLocation(t, app, "Reserve")

	if err := app.Delete(def); err == nil {
		t.Error("the default location was deleted")
	}

	w.ItemA.Set("location", rlf.Id)
	if err := app.Save(w.ItemA); err != nil {
		t.Fatal(err)
	}
	if err := app.Delete(rlf); err == nil {
		t.Error("a location an item is in was deleted")
	}

	testenv.Create(t, app, "checks", map[string]any{"item": w.ItemB.Id, "check_type": w.CheckTypeB.Id,
		"date": "2026-10-01", "result": "passed", "performed_by": w.Mixed.Id, "location": spare.Id})
	w.ItemB.Set("location", rlf.Id)
	if err := app.Save(w.ItemB); err != nil {
		t.Fatal(err)
	}
	if err := app.Delete(spare); err == nil {
		t.Error("a location a check refers to was deleted")
	}

	free := newLocation(t, app, "Frei")
	if err := app.Delete(free); err != nil {
		t.Errorf("an unused location could not be deleted: %v", err)
	}
}
