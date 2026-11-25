package admin

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/material"
)

// errStatusDecided is returned when a check cannot be deleted because it decides the item's status.
var errStatusDecided = errors.New("the check decides the status of the item")

func (a *api) requireCorrections(e *core.RequestEvent) error {
	if !Holds(e.App, e.Auth.Id, Corrections) {
		return e.ForbiddenError("", nil)
	}
	return nil
}

func day(r *core.Record) string {
	return r.GetDateTime("date").Time().Format("2006-01-02")
}

// snapshot is what a correction keeps of a record: the fields a correction can change.
func snapshot(r *core.Record, fields ...string) map[string]any {
	out := map[string]any{}
	for _, field := range fields {
		if field == "date" {
			out[field] = day(r)
		} else {
			out[field] = r.GetString(field)
		}
	}
	return out
}

func correct(app core.App, adminID, action, collection string, r *core.Record, before, after map[string]any) error {
	log, err := app.FindCollectionByNameOrId("corrections")
	if err != nil {
		return err
	}
	row := core.NewRecord(log)
	row.Set("admin", adminID)
	row.Set("action", action)
	row.Set("collection", collection)
	row.Set("record", r.Id)
	row.Set("item", r.GetString("item"))
	row.Set("before", before)
	row.Set("after", after)
	return app.Save(row)
}

var (
	useFields   = []string{"date", "kind", "recorded_by_name", "note"}
	checkFields = []string{"date", "result", "note"}
)

type useEdit struct {
	Date           *string `json:"date"`
	Kind           *string `json:"kind"`
	RecordedByName *string `json:"recordedByName"`
	Note           *string `json:"note"`
}

type checkEdit struct {
	Date   *string `json:"date"`
	Result *string `json:"result"`
	Note   *string `json:"note"`
}

func setDate(r *core.Record, value *string) error {
	if value == nil {
		return nil
	}
	parsed, err := time.Parse("2006-01-02", *value)
	if err != nil {
		return err
	}
	r.Set("date", parsed)
	return nil
}

func (a *api) editUse(e *core.RequestEvent) error {
	if err := a.requireCorrections(e); err != nil {
		return err
	}
	var body useEdit
	if err := decode(e, &body); err != nil {
		return err
	}
	use, err := e.App.FindRecordById("uses", e.Request.PathValue("id"))
	if err != nil {
		return e.NotFoundError("", nil)
	}
	before := snapshot(use, useFields...)
	if err := setDate(use, body.Date); err != nil {
		return e.BadRequestError("Invalid date.", err)
	}
	if body.Kind != nil {
		use.Set("kind", *body.Kind)
	}
	if body.RecordedByName != nil {
		use.Set("recorded_by_name", strings.TrimSpace(*body.RecordedByName))
	}
	if body.Note != nil {
		use.Set("note", *body.Note)
	}
	err = e.App.RunInTransaction(func(tx core.App) error {
		if err := tx.Save(use); err != nil {
			return err
		}
		return correct(tx, e.Auth.Id, "edit", "uses", use, before, snapshot(use, useFields...))
	})
	if err != nil {
		return e.BadRequestError("The use could not be changed.", err)
	}
	a.logger.Info("use corrected", "admin", e.Auth.Id, "use", use.Id)
	return e.JSON(http.StatusOK, snapshot(use, useFields...))
}

func (a *api) deleteUse(e *core.RequestEvent) error {
	if err := a.requireCorrections(e); err != nil {
		return err
	}
	use, err := e.App.FindRecordById("uses", e.Request.PathValue("id"))
	if err != nil {
		return e.NotFoundError("", nil)
	}
	before := snapshot(use, useFields...)
	err = e.App.RunInTransaction(func(tx core.App) error {
		if err := tx.Delete(use); err != nil {
			return err
		}
		return correct(tx, e.Auth.Id, "delete", "uses", use, before, nil)
	})
	if err != nil {
		return e.BadRequestError("The use could not be deleted.", err)
	}
	a.logger.Info("use deleted by a correction", "admin", e.Auth.Id, "use", use.Id)
	return e.NoContent(http.StatusNoContent)
}

// replayedStatus is the status the checks of an item lead to: replayed from active in the order of their dates.
func replayedStatus(app core.App, itemID string) (string, error) {
	checks, err := app.FindRecordsByFilter("checks", "item = {:item}", "date,created", 0, 0, dbx.Params{"item": itemID})
	if err != nil {
		return "", err
	}
	status := "active"
	for _, check := range checks {
		status = material.StatusAfterCheck(status, check.GetString("result"))
	}
	return status, nil
}

// followChecks brings the status of the item in line with its checks after a change to one of them. A
// status that its checks did not explain before (an item retired by hand) is left alone.
func followChecks(tx core.App, itemID, beforeReplay string, refuseChange bool) error {
	item, err := tx.FindRecordById("items", itemID)
	if err != nil {
		return err
	}
	current := item.GetString("status")
	if beforeReplay != current {
		return nil
	}
	after, err := replayedStatus(tx, itemID)
	if err != nil || after == current {
		return err
	}
	if refuseChange {
		return errStatusDecided
	}
	item.Set("status", after)
	return tx.Save(item)
}

func (a *api) editCheck(e *core.RequestEvent) error {
	if err := a.requireCorrections(e); err != nil {
		return err
	}
	var body checkEdit
	if err := decode(e, &body); err != nil {
		return err
	}
	check, err := e.App.FindRecordById("checks", e.Request.PathValue("id"))
	if err != nil {
		return e.NotFoundError("", nil)
	}
	before := snapshot(check, checkFields...)
	if err := setDate(check, body.Date); err != nil {
		return e.BadRequestError("Invalid date.", err)
	}
	if body.Result != nil {
		check.Set("result", *body.Result)
	}
	if body.Note != nil {
		check.Set("note", *body.Note)
	}
	err = e.App.RunInTransaction(func(tx core.App) error {
		itemID := check.GetString("item")
		explained, err := replayedStatus(tx, itemID)
		if err != nil {
			return err
		}
		if err := tx.Save(check); err != nil {
			return err
		}
		if err := followChecks(tx, itemID, explained, false); err != nil {
			return err
		}
		return correct(tx, e.Auth.Id, "edit", "checks", check, before, snapshot(check, checkFields...))
	})
	if err != nil {
		return e.BadRequestError("The check could not be changed.", err)
	}
	a.logger.Info("check corrected", "admin", e.Auth.Id, "check", check.Id)
	return e.JSON(http.StatusOK, snapshot(check, checkFields...))
}

func (a *api) deleteCheck(e *core.RequestEvent) error {
	if err := a.requireCorrections(e); err != nil {
		return err
	}
	check, err := e.App.FindRecordById("checks", e.Request.PathValue("id"))
	if err != nil {
		return e.NotFoundError("", nil)
	}
	before := snapshot(check, checkFields...)
	err = e.App.RunInTransaction(func(tx core.App) error {
		itemID := check.GetString("item")
		explained, err := replayedStatus(tx, itemID)
		if err != nil {
			return err
		}
		if err := tx.Delete(check); err != nil {
			return err
		}
		if err := followChecks(tx, itemID, explained, true); err != nil {
			return err
		}
		return correct(tx, e.Auth.Id, "delete", "checks", check, before, nil)
	})
	if errors.Is(err, errStatusDecided) {
		return e.BadRequestError("This check decides the status of the item. Change its result instead of deleting it.", nil)
	}
	if err != nil {
		return e.BadRequestError("The check could not be deleted.", err)
	}
	a.logger.Info("check deleted by a correction", "admin", e.Auth.Id, "check", check.Id)
	return e.NoContent(http.StatusNoContent)
}
