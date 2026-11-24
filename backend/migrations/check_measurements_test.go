package migrations_test

import (
	"testing"

	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

func TestChecksStoreMeasurements(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)

	checkTypes, err := app.FindCollectionByNameOrId("check_types")
	if err != nil {
		t.Fatal(err)
	}
	if checkTypes.Fields.GetByName("measurements") == nil {
		t.Fatal("check_types has no measurements field")
	}

	checks, err := app.FindCollectionByNameOrId("checks")
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"leak_start_mbar", "leak_end_mbar", "opening_pressure_mbar"} {
		if checks.Fields.GetByName(name) == nil {
			t.Errorf("checks has no %s field", name)
		}
	}

	err = save(t, app, "checks", map[string]any{
		"item": w.ItemA.Id, "check_type": w.CheckTypeA.Id, "date": "2026-11-24", "result": "passed",
		"performed_by": w.Use.Id, "leak_start_mbar": -10, "leak_end_mbar": -9.5, "opening_pressure_mbar": 5.1,
	})
	if err != nil {
		t.Fatalf("a check with measurements does not save: %v", err)
	}
}
