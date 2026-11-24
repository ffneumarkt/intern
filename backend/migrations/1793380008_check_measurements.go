package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(addCheckMeasurements, removeCheckMeasurements)
}

// A check type can ask for the two readings of the mask test: the Dichtprüfung (pressure before and
// after 60 seconds) and the Öffnungsdruck of the exhalation valve. The loss is derived, not stored.
func addCheckMeasurements(app core.App) error {
	checkTypes, err := app.FindCollectionByNameOrId("check_types")
	if err != nil {
		return err
	}
	checkTypes.Fields.Add(&core.BoolField{Name: "measurements"})
	if err := app.Save(checkTypes); err != nil {
		return err
	}

	checks, err := app.FindCollectionByNameOrId("checks")
	if err != nil {
		return err
	}
	checks.Fields.Add(
		&core.NumberField{Name: "leak_start_mbar"},
		&core.NumberField{Name: "leak_end_mbar"},
		&core.NumberField{Name: "opening_pressure_mbar"},
	)
	return app.Save(checks)
}

func removeCheckMeasurements(app core.App) error {
	checks, err := app.FindCollectionByNameOrId("checks")
	if err != nil {
		return err
	}
	checks.Fields.RemoveByName("leak_start_mbar")
	checks.Fields.RemoveByName("leak_end_mbar")
	checks.Fields.RemoveByName("opening_pressure_mbar")
	if err := app.Save(checks); err != nil {
		return err
	}

	checkTypes, err := app.FindCollectionByNameOrId("check_types")
	if err != nil {
		return err
	}
	checkTypes.Fields.RemoveByName("measurements")
	return app.Save(checkTypes)
}
