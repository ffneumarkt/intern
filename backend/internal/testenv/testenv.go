// Package testenv gives tests an app with the real schema and a small set of records. Tests using
// it live in external packages, because it imports the migrations.
package testenv

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/ffneumarkt/intern/backend/internal/material"
	_ "github.com/ffneumarkt/intern/backend/migrations"
)

// Password is the password of all users created by Seed.
const Password = "password1234"

// World holds the records created by Seed. Use, Check and Manage have that level on A only, None
// has no permission, Mixed has use on A and manage on B.
type World struct {
	CategoryA, CategoryB            *core.Record
	None, Use, Check, Manage, Mixed *core.Record
	ItemA, ItemB                    *core.Record
	CheckTypeA, CheckTypeB          *core.Record
}

// New returns an app on an empty database with all migrations applied and the hooks bound.
func New(t testing.TB) *tests.TestApp {
	t.Helper()
	app, err := tests.NewTestAppWithConfig(core.BaseAppConfig{DataDir: t.TempDir(), EncryptionEnv: "x"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(app.Cleanup)
	material.Register(app)
	return app
}

// Seed creates the World.
func Seed(t testing.TB, app core.App) *World {
	t.Helper()
	w := &World{}
	w.CategoryA = Create(t, app, "categories", map[string]any{"name": "A"})
	w.CategoryB = Create(t, app, "categories", map[string]any{"name": "B"})

	w.None = User(t, app, "none@example.com", "None")
	w.Use = User(t, app, "use@example.com", "Use")
	w.Check = User(t, app, "check@example.com", "Check")
	w.Manage = User(t, app, "manage@example.com", "Manage")
	w.Mixed = User(t, app, "mixed@example.com", "Mixed")

	Permit(t, app, w.Use, w.CategoryA, "use")
	Permit(t, app, w.Check, w.CategoryA, "check")
	Permit(t, app, w.Manage, w.CategoryA, "manage")
	Permit(t, app, w.Mixed, w.CategoryA, "use")
	Permit(t, app, w.Mixed, w.CategoryB, "manage")

	w.ItemA = Create(t, app, "items", map[string]any{"category": w.CategoryA.Id, "name": "Item A", "status": "active"})
	w.ItemB = Create(t, app, "items", map[string]any{"category": w.CategoryB.Id, "name": "Item B", "status": "active"})
	w.CheckTypeA = Create(t, app, "check_types", map[string]any{"category": w.CategoryA.Id, "name": "Type A", "interval_months": 12})
	w.CheckTypeB = Create(t, app, "check_types", map[string]any{"category": w.CategoryB.Id, "name": "Type B", "interval_months": 12})
	return w
}

// Create saves a record, failing the test on error.
func Create(t testing.TB, app core.App, collection string, data map[string]any) *core.Record {
	t.Helper()
	c, err := app.FindCollectionByNameOrId(collection)
	if err != nil {
		t.Fatal(err)
	}
	record := core.NewRecord(c)
	record.Load(data)
	if err := app.Save(record); err != nil {
		t.Fatalf("create %s: %v", collection, err)
	}
	return record
}

// User creates a user with Password.
func User(t testing.TB, app core.App, email, name string) *core.Record {
	t.Helper()
	return Create(t, app, "users", map[string]any{"email": email, "name": name, "password": Password})
}

// Permit gives a user a level on a category.
func Permit(t testing.TB, app core.App, user, category *core.Record, level string) *core.Record {
	t.Helper()
	return Create(t, app, "permissions", map[string]any{"user": user.Id, "category": category.Id, "level": level})
}

// Token returns an auth token for a user.
func Token(t testing.TB, user *core.Record) string {
	t.Helper()
	token, err := user.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	return token
}
