package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"

	"github.com/ffneumarkt/intern/backend/internal/admin"
)

func init() {
	m.Register(addAdminAudit, removeAdminAudit)
}

// addAdminAudit adds the record of who changed admin rights, permissions and categories. Hooks write it;
// members holders read it; the API cannot write it.
func addAdminAudit(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	audit := core.NewBaseCollection("admin_audit")
	audit.Fields.Add(
		&core.RelationField{Name: "admin", CollectionId: users.Id, MaxSelect: 1, Required: true},
		&core.SelectField{Name: "action", Values: []string{"create", "update", "delete"}, MaxSelect: 1, Required: true},
		&core.TextField{Name: "collection", Required: true},
		&core.TextField{Name: "record", Required: true},
		&core.JSONField{Name: "summary"},
		created(),
	)
	members := types.Pointer(holds(admin.Members))
	audit.ListRule, audit.ViewRule = members, members
	return app.Save(audit)
}

func removeAdminAudit(app core.App) error {
	audit, err := app.FindCollectionByNameOrId("admin_audit")
	if err != nil {
		return err
	}
	return app.Delete(audit)
}
