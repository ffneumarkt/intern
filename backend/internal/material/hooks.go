package material

import (
	validation "github.com/go-ozzo/ozzo-validation/v4"
	"github.com/pocketbase/pocketbase/core"
)

// Register binds the record hooks.
func Register(app core.App) {
	app.OnRecordCreateExecute("checks").BindFunc(applyCheckResult)
	app.OnRecordValidate("check_types").BindFunc(validateCheckType)
	app.OnRecordAuthRequest("users").BindFunc(rejectDeactivated)
	app.OnRecordUpdate("users").BindFunc(endSessionsOnDeactivation)
}

// applyCheckResult runs in a transaction, so a check never exists without its effect on the item.
func applyCheckResult(e *core.RecordEvent) error {
	orig := e.App
	defer func() { e.App = orig }()
	return orig.RunInTransaction(func(tx core.App) error {
		e.App = tx
		if err := e.Next(); err != nil {
			return err
		}
		item, err := tx.FindRecordById("items", e.Record.GetString("item"))
		if err != nil {
			return err
		}
		status := statusAfterCheck(item.GetString("status"), e.Record.GetString("result"))
		if status == item.GetString("status") {
			return nil
		}
		item.Set("status", status)
		return tx.Save(item)
	})
}

func statusAfterCheck(status, result string) string {
	switch {
	case result == "defect":
		return "defective"
	case result == "retired":
		return "retired"
	case result == "passed" && status == "defective":
		return "active"
	}
	return status
}

func validateCheckType(e *core.RecordEvent) error {
	if e.Record.GetInt("interval_months") == 0 && !e.Record.GetBool("after_use") {
		return validation.Errors{"interval_months": validation.NewError("validation_trigger_required", "an interval or after use is required")}
	}

	targets, err := e.App.FindRecordsByIds("check_types", e.Record.GetStringSlice("also_satisfies"))
	if err != nil {
		return err
	}
	for _, target := range targets {
		if target.GetString("category") != e.Record.GetString("category") {
			return validation.Errors{"also_satisfies": validation.NewError("validation_other_category", "must be of the same category")}
		}
	}
	return e.Next()
}

// rejectDeactivated covers every way to get a token, and answers like a wrong password.
func rejectDeactivated(e *core.RecordAuthRequestEvent) error {
	if e.Record.GetBool("deactivated") {
		return e.BadRequestError("Failed to authenticate.", nil)
	}
	return e.Next()
}

func endSessionsOnDeactivation(e *core.RecordEvent) error {
	if e.Record.GetBool("deactivated") && !e.Record.Original().GetBool("deactivated") {
		e.Record.RefreshTokenKey()
	}
	return e.Next()
}
