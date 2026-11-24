package material

import (
	"encoding/json"
	"net/url"
	"time"

	validation "github.com/go-ozzo/ozzo-validation/v4"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/due"
)

// Register binds the record hooks.
func Register(app core.App) {
	app.OnRecordCreateExecute("checks").BindFunc(applyCheckResult)
	app.OnRecordCreateExecute("uses").BindFunc(moveItemAfterUse)
	app.OnRecordDelete("locations").BindFunc(guardLocationDelete)
	app.OnRecordValidate("check_types").BindFunc(validateCheckType)
	app.OnRecordCreateExecute("check_types").BindFunc(keepOneDefault)
	app.OnRecordUpdateExecute("check_types").BindFunc(keepOneDefault)
	app.OnRecordValidate("uses", "checks").BindFunc(rejectFutureDate)
	app.OnRecordValidate("notification_settings").BindFunc(validateTimings)
	app.OnRecordValidate("notification_preferences").BindFunc(validateQuietTime)
	app.OnRecordValidate("push_subscriptions").BindFunc(validateEndpoint)
	app.OnRecordAuthRequest("users").BindFunc(rejectDeactivated)
	app.OnRecordUpdate("users").BindFunc(endSessionsOnDeactivation)
}

// inTransaction runs the rest of the save and then effects in one transaction.
func inTransaction(e *core.RecordEvent, effects func(tx core.App) error) error {
	orig := e.App
	defer func() { e.App = orig }()
	return orig.RunInTransaction(func(tx core.App) error {
		e.App = tx
		if err := e.Next(); err != nil {
			return err
		}
		return effects(tx)
	})
}

// applyCheckResult keeps a check and its effect on the item together.
func applyCheckResult(e *core.RecordEvent) error {
	return inTransaction(e, func(tx core.App) error {
		item, err := tx.FindRecordById("items", e.Record.GetString("item"))
		if err != nil {
			return err
		}
		changed := false
		if status := statusAfterCheck(item.GetString("status"), e.Record.GetString("result")); status != item.GetString("status") {
			item.Set("status", status)
			changed = true
		}
		// A check with a location moves the item there; without one it records where the item is.
		if place := e.Record.GetString("location"); place == "" {
			e.Record.Set("location", item.GetString("location"))
			if err := tx.Save(e.Record); err != nil {
				return err
			}
		} else if place != item.GetString("location") {
			item.Set("location", place)
			changed = true
		}
		if !changed {
			return nil
		}
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

// keepOneDefault clears the previous default of the category when a new one is saved.
func keepOneDefault(e *core.RecordEvent) error {
	if !e.Record.GetBool("is_default") {
		return e.Next()
	}
	return inTransaction(e, func(tx core.App) error {
		defaults, err := tx.FindAllRecords("check_types", dbx.HashExp{"category": e.Record.GetString("category"), "is_default": true})
		if err != nil {
			return err
		}
		for _, other := range defaults {
			if other.Id == e.Record.Id {
				continue
			}
			other.Set("is_default", false)
			if err := tx.Save(other); err != nil {
				return err
			}
		}
		return nil
	})
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

// rejectFutureDate catches typos: a passed check dated years ahead would silently mark an item as
// not due, and users cannot correct history.
func rejectFutureDate(e *core.RecordEvent) error {
	if calendarDate(e.Record, "date").After(due.Today()) {
		return validation.Errors{"date": validation.NewError("validation_future_date", "must not be in the future")}
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

// maxTimingDays is how far ahead of a due date a notification can be asked for.
const maxTimingDays = 90

// validateTimings accepts a list of distinct whole days from 0 to maxTimingDays, or nothing.
func validateTimings(e *core.RecordEvent) error {
	raw, err := json.Marshal(e.Record.Get("timings"))
	if err != nil {
		return err
	}
	var days []float64
	if err := json.Unmarshal(raw, &days); err != nil {
		return validation.Errors{"timings": validation.NewError("validation_timings", "must be a list of days")}
	}
	seen := map[float64]bool{}
	for _, day := range days {
		if day != float64(int(day)) || day < 0 || day > maxTimingDays || seen[day] {
			return validation.Errors{"timings": validation.NewError("validation_timings", "must be distinct whole days from 0 to 90")}
		}
		seen[day] = true
	}
	return e.Next()
}

// validateQuietTime requires both times as HH:MM, and different from each other.
func validateQuietTime(e *core.RecordEvent) error {
	from, until := e.Record.GetString("quiet_from"), e.Record.GetString("quiet_until")
	if from == "" && until == "" {
		return e.Next()
	}
	_, errFrom := time.Parse("15:04", from)
	_, errUntil := time.Parse("15:04", until)
	if errFrom != nil || len(from) != 5 {
		return validation.Errors{"quiet_from": validation.NewError("validation_quiet_time", "must be a time as HH:MM")}
	}
	if errUntil != nil || len(until) != 5 {
		return validation.Errors{"quiet_until": validation.NewError("validation_quiet_time", "must be a time as HH:MM")}
	}
	if from == until {
		return validation.Errors{"quiet_until": validation.NewError("validation_quiet_time", "must differ from the start")}
	}
	return e.Next()
}

// validateEndpoint requires HTTPS, so a user cannot point the server's requests at plain internal
// addresses.
func validateEndpoint(e *core.RecordEvent) error {
	u, err := url.Parse(e.Record.GetString("endpoint"))
	if err != nil || u.Scheme != "https" || u.Host == "" {
		return validation.Errors{"endpoint": validation.NewError("validation_endpoint", "must be an https URL")}
	}
	return e.Next()
}

// moveItemAfterUse puts an item in the default location after a use, and notes it on the use: a used
// mask goes back to the workshop.
func moveItemAfterUse(e *core.RecordEvent) error {
	return inTransaction(e, func(tx core.App) error {
		home, err := tx.FindFirstRecordByData("locations", "is_default", true)
		if err != nil {
			return err
		}
		e.Record.Set("location", home.Id)
		if err := tx.Save(e.Record); err != nil {
			return err
		}
		item, err := tx.FindRecordById("items", e.Record.GetString("item"))
		if err != nil {
			return err
		}
		if item.GetString("location") == home.Id {
			return nil
		}
		item.Set("location", home.Id)
		return tx.Save(item)
	})
}

// guardLocationDelete keeps the default location, and any location that an item, a use or a check
// still refers to, so history never points at nothing.
func guardLocationDelete(e *core.RecordEvent) error {
	if e.Record.GetBool("is_default") {
		return validation.Errors{"is_default": validation.NewError("validation_default_location", "the default location cannot be deleted")}
	}
	for _, collection := range []string{"items", "uses", "checks"} {
		n, err := e.App.CountRecords(collection, dbx.HashExp{"location": e.Record.Id})
		if err != nil {
			return err
		}
		if n > 0 {
			return validation.Errors{"location": validation.NewError("validation_location_in_use", "the location is still in use")}
		}
	}
	return e.Next()
}
