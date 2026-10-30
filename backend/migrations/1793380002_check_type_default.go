package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(addCheckTypeDefault, removeCheckTypeDefault)
}

func addCheckTypeDefault(app core.App) error {
	checkTypes, err := app.FindCollectionByNameOrId("check_types")
	if err != nil {
		return err
	}
	checkTypes.Fields.Add(&core.BoolField{Name: "is_default"})
	return app.Save(checkTypes)
}

func removeCheckTypeDefault(app core.App) error {
	checkTypes, err := app.FindCollectionByNameOrId("check_types")
	if err != nil {
		return err
	}
	checkTypes.Fields.RemoveByName("is_default")
	return app.Save(checkTypes)
}
