package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(addLocations, removeLocations)
}

// workshop is the default location: where an item is after a use, and the first choice after a check.
const workshop = "AS-Werkstatt"

// manageAnywhere is the manage level in at least one category. Locations belong to no category, so
// whoever manages equipment somewhere may manage them.
const manageAnywhere = `@collection.permissions.user ?= @request.auth.id && @collection.permissions.level ?= "manage"`

// addLocations adds the managed list of places an item can be (the workshop, the trucks) and the
// current location of an item, kept on every use and check as well for the history.
func addLocations(app core.App) error {
	locations := core.NewBaseCollection("locations")
	locations.Fields.Add(
		&core.TextField{Name: "name", Required: true},
		&core.BoolField{Name: "is_default"},
		created(),
	)
	locations.AddIndex("idx_locations_name", true, "name", "")
	locations.ListRule = types.Pointer(loggedIn)
	locations.ViewRule = types.Pointer(loggedIn)
	// The default location exists from this migration on and is never created, flagged or unflagged through the API.
	locations.CreateRule = types.Pointer(manageAnywhere + ` && (@request.body.is_default:isset = false || @request.body.is_default = false)`)
	locations.UpdateRule = types.Pointer(manageAnywhere + ` && @request.body.is_default:changed = false`)
	locations.DeleteRule = types.Pointer(manageAnywhere)
	if err := app.Save(locations); err != nil {
		return err
	}

	home := core.NewRecord(locations)
	home.Set("name", workshop)
	home.Set("is_default", true)
	if err := app.Save(home); err != nil {
		return err
	}

	for _, name := range []string{"items", "uses", "checks"} {
		collection, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			return err
		}
		collection.Fields.Add(&core.RelationField{Name: "location", CollectionId: locations.Id, MaxSelect: 1})
		if err := app.Save(collection); err != nil {
			return err
		}
	}

	// Everything that exists so far is in the workshop.
	_, err := app.DB().NewQuery("UPDATE items SET location = {:id}").Bind(map[string]any{"id": home.Id}).Execute()
	return err
}

func removeLocations(app core.App) error {
	for _, name := range []string{"items", "uses", "checks"} {
		collection, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			return err
		}
		collection.Fields.RemoveByName("location")
		if err := app.Save(collection); err != nil {
			return err
		}
	}
	locations, err := app.FindCollectionByNameOrId("locations")
	if err != nil {
		return err
	}
	return app.Delete(locations)
}
