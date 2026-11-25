package admin

import (
	validation "github.com/go-ozzo/ozzo-validation/v4"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// Register binds the hooks that guard the admin areas.
func Register(app core.App) {
	app.OnRecordDelete("admin_rights").BindFunc(keepLastMembersHolder)
	app.OnRecordUpdate("users").BindFunc(keepLastActiveMembersHolder)
	app.OnRecordDelete("categories").BindFunc(guardCategoryDelete)
	bindAudit(app)
}

// otherActiveHolders counts the active holders of the members right other than the row except.
func otherActiveHolders(app core.App, except string) (int, error) {
	rows, err := app.FindRecordsByFilter("admin_rights", "area = {:area} && id != {:except} && user.deactivated = false", "", 0, 0,
		dbx.Params{"area": Members, "except": except})
	return len(rows), err
}

// keepLastMembersHolder refuses to delete the last members row, so nobody can lock the app out of its admin area.
func keepLastMembersHolder(e *core.RecordEvent) error {
	if e.Record.GetString("area") == Members {
		n, err := otherActiveHolders(e.App, e.Record.Id)
		if err != nil {
			return err
		}
		if n == 0 {
			return validation.Errors{"area": validation.NewError("validation_last_members_holder", "the last holder of the members right cannot lose it")}
		}
	}
	return e.Next()
}

// keepLastActiveMembersHolder refuses to deactivate the last active holder of the members right.
func keepLastActiveMembersHolder(e *core.RecordEvent) error {
	if e.Record.GetBool("deactivated") && !e.Record.Original().GetBool("deactivated") {
		own, err := e.App.FindFirstRecordByFilter("admin_rights", "user = {:user} && area = {:area}",
			dbx.Params{"user": e.Record.Id, "area": Members})
		if err == nil {
			n, err := otherActiveHolders(e.App, own.Id)
			if err != nil {
				return err
			}
			if n == 0 {
				return validation.Errors{"deactivated": validation.NewError("validation_last_members_holder", "the last holder of the members right cannot be deactivated")}
			}
		}
	}
	return e.Next()
}

// guardCategoryDelete refuses a category that has items. What is left of an empty one (who may see it,
// its check types and notification settings) goes with it in the same transaction.
func guardCategoryDelete(e *core.RecordEvent) error {
	n, err := e.App.CountRecords("items", dbx.HashExp{"category": e.Record.Id})
	if err != nil {
		return err
	}
	if n > 0 {
		return validation.Errors{"category": validation.NewError("validation_category_in_use", "the category still has items")}
	}
	orig := e.App
	defer func() { e.App = orig }()
	return orig.RunInTransaction(func(tx core.App) error {
		for _, collection := range []string{"check_types", "permissions", "notification_settings"} {
			rows, err := tx.FindAllRecords(collection, dbx.HashExp{"category": e.Record.Id})
			if err != nil {
				return err
			}
			for _, row := range rows {
				if err := tx.Delete(row); err != nil {
					return err
				}
			}
		}
		e.App = tx
		return e.Next()
	})
}
