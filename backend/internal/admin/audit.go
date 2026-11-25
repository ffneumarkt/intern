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

// record runs the request and saves who did what in the same transaction, so a change never stays without
// its audit row. The summary holds the public fields of the record, never anything secret: these
// collections hold none.
func record(e *core.RecordRequestEvent, action string, next func() error, before map[string]any) error {
	summary := map[string]any{"after": e.Record.PublicExport()}
	if before != nil {
		summary["before"] = before
	}
	orig := e.App
	defer func() { e.App = orig }()
	return orig.RunInTransaction(func(tx core.App) error {
		e.App = tx
		if err := next(); err != nil {
			return err
		}
		if e.Auth == nil {
			return nil
		}
		return Log(tx, e.Auth.Id, action, e.Collection.Name, e.Record.Id, summary)
	})
}

// Log saves one audit row: who did what to which record. The summary must hold nothing secret.
func Log(app core.App, adminID, action, collection, recordID string, summary map[string]any) error {
	audit, err := app.FindCollectionByNameOrId("admin_audit")
	if err != nil {
		return err
	}
	row := core.NewRecord(audit)
	row.Set("admin", adminID)
	row.Set("action", action)
	row.Set("collection", collection)
	row.Set("record", recordID)
	row.Set("summary", summary)
	return app.Save(row)
}
