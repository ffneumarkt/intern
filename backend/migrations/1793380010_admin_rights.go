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
	return app.Save(rights)
}

func removeAdminRights(app core.App) error {
	rights, err := app.FindCollectionByNameOrId("admin_rights")
	if err != nil {
		return err
	}
	return app.Delete(rights)
}
