package admin_test

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/admin"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

func rightOf(t *testing.T, app core.App, user *core.Record, area string) *core.Record {
	t.Helper()
	row, err := app.FindFirstRecordByFilter("admin_rights", "user = {:u} && area = {:a}", map[string]any{"u": user.Id, "a": area})
	if err != nil {
		t.Fatal(err)
	}
	return row
}

func TestLastMembersHolderStays(t *testing.T) {
	app := testenv.New(t)
	first := testenv.Admin(t, app, testenv.User(t, app, "a@example.com", "A"), admin.Members, admin.Transport)
	if err := app.Delete(rightOf(t, app, first, admin.Members)); err == nil {
		t.Fatal("the last members row was deleted")
	}
	if err := app.Delete(rightOf(t, app, first, admin.Transport)); err != nil {
		t.Fatalf("another area must delete freely: %v", err)
	}
	second := testenv.Admin(t, app, testenv.User(t, app, "b@example.com", "B"), admin.Members)
	if err := app.Delete(rightOf(t, app, first, admin.Members)); err != nil {
		t.Fatalf("with a second holder the first row deletes: %v", err)
	}
	if err := app.Delete(rightOf(t, app, second, admin.Members)); err == nil {
		t.Fatal("the second holder is now the last one")
	}
}

func TestLastActiveMembersHolderCannotBeDeactivated(t *testing.T) {
	app := testenv.New(t)
	first := testenv.Admin(t, app, testenv.User(t, app, "a@example.com", "A"), admin.Members)
	first.Set("deactivated", true)
	if err := app.Save(first); err == nil {
		t.Fatal("the only holder was deactivated")
	}

	second := testenv.Admin(t, app, testenv.User(t, app, "b@example.com", "B"), admin.Members)
	reloaded, _ := app.FindRecordById("users", first.Id)
	reloaded.Set("deactivated", true)
	if err := app.Save(reloaded); err != nil {
		t.Fatalf("with a second active holder: %v", err)
	}
	// The first one no longer counts, so the second is the last active holder.
	second.Set("deactivated", true)
	if err := app.Save(second); err == nil {
		t.Fatal("a deactivated holder does not count")
	}
}

func TestCategoryWithItemsCannotBeDeleted(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	if err := app.Delete(w.CategoryA); err == nil {
		t.Fatal("a category with items was deleted")
	}
	empty := testenv.Create(t, app, "categories", map[string]any{"name": "Leer"})
	testenv.Permit(t, app, w.Use, empty, "use")
	testenv.Create(t, app, "check_types", map[string]any{"category": empty.Id, "name": "T", "interval_months": 12})
	if err := app.Delete(empty); err != nil {
		t.Fatalf("an empty category with permission and check type rows must delete cleanly: %v", err)
	}
}
