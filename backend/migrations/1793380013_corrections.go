package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"

	"github.com/ffneumarkt/intern/backend/internal/admin"
)

func init() {
	m.Register(addCorrections, removeCorrections)
}

// addCorrections adds the record of every edit or delete of a use or a check. History stays immutable
// through the collection API; only the correction routes change it, and they write one row each time.
func addCorrections(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	corrections := core.NewBaseCollection("corrections")
	corrections.Fields.Add(
		&core.RelationField{Name: "admin", CollectionId: users.Id, MaxSelect: 1, Required: true},
		&core.SelectField{Name: "action", Values: []string{"edit", "delete"}, MaxSelect: 1, Required: true},
		&core.SelectField{Name: "collection", Values: []string{"uses", "checks"}, MaxSelect: 1, Required: true},
		&core.TextField{Name: "record", Required: true},
		// The item the record belonged to, so the item page can list its corrections.
		&core.TextField{Name: "item", Required: true},
		&core.JSONField{Name: "before"},
		&core.JSONField{Name: "after"},
		created(),
	)
	readers := types.Pointer(holds(admin.Corrections))
	corrections.ListRule, corrections.ViewRule = readers, readers
	return app.Save(corrections)
}

func removeCorrections(app core.App) error {
	corrections, err := app.FindCollectionByNameOrId("corrections")
	if err != nil {
		return err
	}
	return app.Delete(corrections)
}
