package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(createCollections, deleteCollections)
}

const manyRelations = 99

func createCollections(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	users.Fields.Add(&core.BoolField{Name: "deactivated"})
	if err := app.Save(users); err != nil {
		return err
	}

	categories := core.NewBaseCollection("categories")
	categories.Fields.Add(
		&core.TextField{Name: "name", Required: true},
		optionalCount("max_service_life_years"),
	)
	if err := app.Save(categories); err != nil {
		return err
	}

	permissions := core.NewBaseCollection("permissions")
	permissions.Fields.Add(
		ownedBy("user", users),
		ownedBy("category", categories),
		&core.SelectField{Name: "level", Required: true, MaxSelect: 1, Values: []string{"use", "check", "manage"}},
	)
	permissions.AddIndex("idx_permissions_user_category", true, "user, category", "")
	if err := app.Save(permissions); err != nil {
		return err
	}

	checkTypes := core.NewBaseCollection("check_types")
	checkTypes.Fields.Add(
		reference("category", categories),
		&core.TextField{Name: "name", Required: true},
		optionalCount("interval_months"),
		&core.BoolField{Name: "after_use"},
	)
	if err := app.Save(checkTypes); err != nil {
		return err
	}
	// A self relation needs the collection's id, which exists only after the first save.
	checkTypes.Fields.Add(&core.RelationField{Name: "also_satisfies", CollectionId: checkTypes.Id, MaxSelect: manyRelations})
	if err := app.Save(checkTypes); err != nil {
		return err
	}

	items := core.NewBaseCollection("items")
	items.Fields.Add(
		reference("category", categories),
		&core.TextField{Name: "name", Required: true},
		&core.TextField{Name: "serial"},
		&core.TextField{Name: "barcode"},
		&core.DateField{Name: "manufactured_on"},
		&core.SelectField{Name: "status", Required: true, MaxSelect: 1, Values: []string{"active", "defective", "retired"}},
		&core.TextField{Name: "note"},
		created(),
	)
	items.AddIndex("idx_items_barcode", true, "barcode", "barcode != ''")
	if err := app.Save(items); err != nil {
		return err
	}

	uses := core.NewBaseCollection("uses")
	uses.Fields.Add(
		ownedBy("item", items),
		&core.DateField{Name: "date", Required: true},
		&core.SelectField{Name: "kind", Required: true, MaxSelect: 1, Values: []string{"operation", "exercise", "other"}},
		&core.TextField{Name: "recorded_by_name"},
		&core.TextField{Name: "note"},
		reference("created_by", users),
		created(),
	)
	if err := app.Save(uses); err != nil {
		return err
	}

	checks := core.NewBaseCollection("checks")
	checks.Fields.Add(
		ownedBy("item", items),
		reference("check_type", checkTypes),
		&core.DateField{Name: "date", Required: true},
		&core.SelectField{Name: "result", Required: true, MaxSelect: 1, Values: []string{"passed", "defect", "retired"}},
		reference("performed_by", users),
		&core.TextField{Name: "note"},
		created(),
	)
	if err := app.Save(checks); err != nil {
		return err
	}

	settings := core.NewBaseCollection("notification_settings")
	settings.Fields.Add(
		ownedBy("user", users),
		ownedBy("category", categories),
		&core.JSONField{Name: "timings"},
		&core.BoolField{Name: "weekly_overdue"},
	)
	settings.AddIndex("idx_notification_settings_user_category", true, "user, category", "")
	if err := app.Save(settings); err != nil {
		return err
	}

	subscriptions := core.NewBaseCollection("push_subscriptions")
	subscriptions.Fields.Add(
		ownedBy("user", users),
		&core.TextField{Name: "endpoint", Required: true},
		&core.TextField{Name: "p256dh"},
		&core.TextField{Name: "auth"},
		&core.TextField{Name: "device_label"},
	)
	subscriptions.AddIndex("idx_push_subscriptions_endpoint", true, "endpoint", "")
	if err := app.Save(subscriptions); err != nil {
		return err
	}

	passkeys := core.NewBaseCollection("passkeys")
	passkeys.Fields.Add(
		ownedBy("user", users),
		&core.TextField{Name: "credential_id", Required: true},
		&core.TextField{Name: "public_key", Required: true},
		optionalCount("sign_count"),
		&core.TextField{Name: "aaguid"},
		&core.TextField{Name: "name", Required: true},
	)
	passkeys.AddIndex("idx_passkeys_credential_id", true, "credential_id", "")
	if err := app.Save(passkeys); err != nil {
		return err
	}

	log := core.NewBaseCollection("notification_log")
	log.Fields.Add(
		ownedBy("user", users),
		ownedBy("item", items),
		&core.TextField{Name: "reason", Required: true},
		&core.DateField{Name: "due_date", Required: true},
		&core.TextField{Name: "timing", Required: true},
		&core.DateField{Name: "sent_on", Required: true},
	)
	log.AddIndex("idx_notification_log_dedupe", true, "user, item, reason, due_date, timing, sent_on", "")
	if err := app.Save(log); err != nil {
		return err
	}

	transport := core.NewBaseCollection("transport_document_settings")
	transport.Fields.Add(
		&core.TextField{Name: "station_name"},
		&core.TextField{Name: "station_street"},
		&core.TextField{Name: "station_postal_code"},
		&core.TextField{Name: "station_town"},
		&core.TextField{Name: "cylinder_label"},
		optionalCount("cylinder_litres_tenths"),
		optionalCount("points_limit"),
		&core.TextField{Name: "filling_station_name"},
		&core.TextField{Name: "filling_station_street"},
		&core.TextField{Name: "filling_station_postal_code"},
		&core.TextField{Name: "filling_station_town"},
		&core.JSONField{Name: "checklist"},
	)
	return app.Save(transport)
}

func deleteCollections(app core.App) error {
	for _, name := range []string{
		"transport_document_settings", "notification_log", "passkeys", "push_subscriptions", "notification_settings",
		"checks", "uses", "items", "check_types", "permissions", "categories",
	} {
		collection, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			return err
		}
		if err := app.Delete(collection); err != nil {
			return err
		}
	}

	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	users.Fields.RemoveByName("deactivated")
	return app.Save(users)
}

// ownedBy is a required relation whose record goes when the target goes.
func ownedBy(name string, target *core.Collection) *core.RelationField {
	return &core.RelationField{Name: name, CollectionId: target.Id, MaxSelect: 1, Required: true, CascadeDelete: true}
}

// reference is a required relation that blocks deleting the target, which keeps the history whole.
func reference(name string, target *core.Collection) *core.RelationField {
	return &core.RelationField{Name: name, CollectionId: target.Id, MaxSelect: 1, Required: true}
}

// optionalCount is a whole number where 0 means unset.
func optionalCount(name string) *core.NumberField {
	return &core.NumberField{Name: name, OnlyInt: true, Min: types.Pointer(0.0)}
}

func created() *core.AutodateField {
	return &core.AutodateField{Name: "created", OnCreate: true}
}
