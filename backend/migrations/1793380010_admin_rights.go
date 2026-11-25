package migrations

import (
	"fmt"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"

	"github.com/ffneumarkt/intern/backend/internal/admin"
)

func init() {
	m.Register(addAdminRights, removeAdminRights)
}

// holds requires the current user to hold the admin area. All conditions on @collection.admin_rights
// in a rule match the same row.
func holds(area string) string {
	return fmt.Sprintf(`(@collection.admin_rights.user ?= @request.auth.id && @collection.admin_rights.area ?= %q)`, area)
}

// addAdminRights adds the admin rights (one row per user and area) that let members administer the
// app without the PocketBase dashboard.
func addAdminRights(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	rights := core.NewBaseCollection("admin_rights")
	rights.Fields.Add(
		&core.RelationField{Name: "user", CollectionId: users.Id, MaxSelect: 1, Required: true},
		&core.SelectField{Name: "area", Values: admin.Areas, MaxSelect: 1, Required: true},
		created(),
	)
	rights.AddIndex("idx_admin_rights_user_area", true, "user, area", "")
	both := types.Pointer(`user = @request.auth.id || ` + holds(admin.Members))
	rights.ListRule, rights.ViewRule = both, both
	rights.CreateRule = types.Pointer(holds(admin.Members))
	rights.DeleteRule = types.Pointer(holds(admin.Members))
	if err := app.Save(rights); err != nil {
		return err
	}
	return widenRules(app)
}

// widenRules lets the admin areas write where the dashboard was needed before. The users rules stay
// closed: members are managed through Go routes, which accept only the fields they name.
func widenRules(app core.App) error {
	permissions, err := app.FindCollectionByNameOrId("permissions")
	if err != nil {
		return err
	}
	mine := types.Pointer(`user = @request.auth.id || ` + holds(admin.Members))
	permissions.ListRule, permissions.ViewRule = mine, mine
	admins := types.Pointer(holds(admin.Members))
	permissions.CreateRule, permissions.UpdateRule, permissions.DeleteRule = admins, admins, admins
	if err := app.Save(permissions); err != nil {
		return err
	}

	categories, err := app.FindCollectionByNameOrId("categories")
	if err != nil {
		return err
	}
	visible := types.Pointer(anyLevel("id") + ` || ` + holds(admin.Categories))
	categories.ListRule, categories.ViewRule = visible, visible
	editors := types.Pointer(holds(admin.Categories))
	categories.CreateRule, categories.UpdateRule, categories.DeleteRule = editors, editors, editors
	if err := app.Save(categories); err != nil {
		return err
	}

	transport, err := app.FindCollectionByNameOrId("transport_document_settings")
	if err != nil {
		return err
	}
	transport.UpdateRule = types.Pointer(holds(admin.Transport))
	return app.Save(transport)
}

func removeAdminRights(app core.App) error {
	if err := setRules(app); err != nil {
		return err
	}
	rights, err := app.FindCollectionByNameOrId("admin_rights")
	if err != nil {
		return err
	}
	return app.Delete(rights)
}
