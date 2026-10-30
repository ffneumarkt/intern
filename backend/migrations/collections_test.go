package migrations_test

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

func TestCollectionsExist(t *testing.T) {
	app := testenv.New(t)
	for _, name := range []string{
		"users", "categories", "permissions", "check_types", "items", "uses", "checks", "notification_settings",
		"push_subscriptions", "passkeys", "notification_log", "transport_document_settings",
	} {
		if _, err := app.FindCollectionByNameOrId(name); err != nil {
			t.Errorf("%s: %v", name, err)
		}
	}
}

func save(t *testing.T, app core.App, collection string, data map[string]any) error {
	t.Helper()
	c, err := app.FindCollectionByNameOrId(collection)
	if err != nil {
		t.Fatal(err)
	}
	record := core.NewRecord(c)
	record.Load(data)
	return app.Save(record)
}

func TestUniqueConstraints(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)

	unique := map[string]map[string]any{
		"permissions":           {"user": w.Use.Id, "category": w.CategoryA.Id, "level": "manage"},
		"notification_settings": {"user": w.Use.Id, "category": w.CategoryA.Id},
		"push_subscriptions":    {"user": w.Use.Id, "endpoint": "https://push.example.com/1"},
		"passkeys":              {"user": w.Use.Id, "credential_id": "cred", "public_key": "key", "name": "Telefon"},
		"notification_log": {"user": w.Use.Id, "item": w.ItemA.Id, "reason": "end_of_life",
			"due_date": "2026-10-30", "timing": "0", "sent_on": "2026-10-30"},
	}
	for collection, data := range unique {
		if collection != "permissions" {
			if err := save(t, app, collection, data); err != nil {
				t.Fatalf("%s first: %v", collection, err)
			}
		}
		if err := save(t, app, collection, data); err == nil {
			t.Errorf("%s: duplicate accepted", collection)
		}
	}
}

func TestBarcodeUniqueWhenSet(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	item := func(barcode string) map[string]any {
		return map[string]any{"category": w.CategoryA.Id, "name": "x", "status": "active", "barcode": barcode}
	}
	for _, barcode := range []string{"", "", "X"} {
		if err := save(t, app, "items", item(barcode)); err != nil {
			t.Fatalf("barcode %q: %v", barcode, err)
		}
	}
	if err := save(t, app, "items", item("X")); err == nil {
		t.Error("duplicate barcode accepted")
	}
}

func TestItemCreatedIsSet(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	if w.ItemA.GetDateTime("created").IsZero() {
		t.Error("created is empty")
	}
}

func TestAnItemWithoutHistoryCanBeDeleted(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	if err := app.Delete(w.ItemA); err != nil {
		t.Fatal(err)
	}
}

func TestHistoryKeepsItsItem(t *testing.T) {
	entries := map[string]func(w *testenv.World) map[string]any{
		"uses": func(w *testenv.World) map[string]any {
			return map[string]any{"item": w.ItemA.Id, "date": "2026-10-01", "kind": "other", "created_by": w.Use.Id}
		},
		"checks": func(w *testenv.World) map[string]any {
			return map[string]any{"item": w.ItemA.Id, "check_type": w.CheckTypeA.Id, "date": "2026-10-01",
				"result": "passed", "performed_by": w.Check.Id}
		},
	}
	for collection, entry := range entries {
		t.Run(collection, func(t *testing.T) {
			app := testenv.New(t)
			w := testenv.Seed(t, app)
			testenv.Create(t, app, collection, entry(w))
			if err := app.Delete(w.ItemA); err == nil {
				t.Error("item with history deleted")
			}
			if n, err := app.CountRecords(collection); err != nil || n != 1 {
				t.Errorf("%s: %d left, err %v", collection, n, err)
			}
		})
	}
}

func TestHistoryBlocksDeletes(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	testenv.Create(t, app, "checks", map[string]any{"item": w.ItemA.Id, "check_type": w.CheckTypeA.Id,
		"date": "2026-10-01", "result": "passed", "performed_by": w.Check.Id})
	if err := app.Delete(w.CheckTypeA); err == nil {
		t.Error("check type with checks deleted")
	}
	if err := app.Delete(w.Check); err == nil {
		t.Error("user with checks deleted")
	}
}

func TestUsersCanBeDeactivated(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	if w.Use.GetBool("deactivated") {
		t.Error("new users must be active")
	}
	w.Use.Set("deactivated", true)
	if err := app.Save(w.Use); err != nil {
		t.Fatal(err)
	}
	reloaded, err := app.FindRecordById("users", w.Use.Id)
	if err != nil {
		t.Fatal(err)
	}
	if !reloaded.GetBool("deactivated") {
		t.Error("flag not stored")
	}
}
