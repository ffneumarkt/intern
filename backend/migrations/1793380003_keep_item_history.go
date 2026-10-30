package migrations

import (
	"errors"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(
		func(app core.App) error { return setHistoryCascade(app, false) },
		func(app core.App) error { return setHistoryCascade(app, true) },
	)
}

// setHistoryCascade decides whether deleting an item takes its uses and checks along. Without the
// cascade a required relation blocks the delete, so an item with history can only be retired.
func setHistoryCascade(app core.App, cascade bool) error {
	for _, name := range []string{"uses", "checks"} {
		collection, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			return err
		}
		item, ok := collection.Fields.GetByName("item").(*core.RelationField)
		if !ok {
			return errors.New(name + ".item is not a relation")
		}
		item.CascadeDelete = cascade
		if err := app.Save(collection); err != nil {
			return err
		}
	}
	return nil
}
