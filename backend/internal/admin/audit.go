package admin

import (
	"github.com/pocketbase/pocketbase/core"
)

// audited are the collections whose changes through the API leave an audit row.
var audited = []string{"admin_rights", "permissions", "categories"}

func bindAudit(app core.App) {
	app.OnRecordCreateRequest(audited...).BindFunc(func(e *core.RecordRequestEvent) error {
		return record(e, "create", e.Next, nil)
	})
	app.OnRecordUpdateRequest(audited...).BindFunc(func(e *core.RecordRequestEvent) error {
		before := e.Record.Original().PublicExport()
		return record(e, "update", e.Next, before)
	})
	app.OnRecordDeleteRequest(audited...).BindFunc(func(e *core.RecordRequestEvent) error {
		return record(e, "delete", e.Next, nil)
	})
}

// record runs the request and, when it succeeded, saves who did what. The summary holds the public fields
// of the record, never anything secret: these collections hold none.
func record(e *core.RecordRequestEvent, action string, next func() error, before map[string]any) error {
	summary := map[string]any{"after": e.Record.PublicExport()}
	if before != nil {
		summary["before"] = before
	}
	if err := next(); err != nil {
		return err
	}
	if e.Auth == nil {
		return nil
	}
	audit, err := e.App.FindCollectionByNameOrId("admin_audit")
	if err != nil {
		return err
	}
	row := core.NewRecord(audit)
	row.Set("admin", e.Auth.Id)
	row.Set("action", action)
	row.Set("collection", e.Collection.Name)
	row.Set("record", e.Record.Id)
	row.Set("summary", summary)
	return e.App.Save(row)
}
