package defaults_test

import (
	"testing"

	"github.com/ffneumarkt/intern/backend/internal/admin"
	"github.com/ffneumarkt/intern/backend/internal/defaults"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

func TestApplyCreatesTheStationSetup(t *testing.T) {
	app := testenv.New(t)
	summary, err := defaults.Apply(app)
	if err != nil {
		t.Fatal(err)
	}
	if summary.Categories != 2 || summary.CheckTypes != 3 || summary.Locations != 2 {
		t.Fatalf("summary %+v", summary)
	}
	masks, err := app.FindFirstRecordByData("categories", "name", "Atemschutzmasken")
	if err != nil {
		t.Fatal(err)
	}
	if masks.GetInt("max_service_life_years") != 15 {
		t.Fatalf("service life %d", masks.GetInt("max_service_life_years"))
	}
	five, err := app.FindFirstRecordByData("check_types", "name", "5-Jahres-Prüfung")
	if err != nil {
		t.Fatal(err)
	}
	standard, err := app.FindFirstRecordByData("check_types", "name", "Maskenprüfung")
	if err != nil {
		t.Fatal(err)
	}
	if got := five.GetStringSlice("also_satisfies"); len(got) != 1 || got[0] != standard.Id {
		t.Fatalf("the 5-year check should also satisfy the mask check: %v", got)
	}
	if !standard.GetBool("is_default") || !standard.GetBool("measurements") {
		t.Fatal("the mask check is the default and records measurements")
	}
	for _, name := range []string{"RLF", "LAST"} {
		if _, err := app.FindFirstRecordByData("locations", "name", name); err != nil {
			t.Fatalf("location %s: %v", name, err)
		}
	}
}

func TestApplyTwiceChangesNothing(t *testing.T) {
	app := testenv.New(t)
	if _, err := defaults.Apply(app); err != nil {
		t.Fatal(err)
	}
	summary, err := defaults.Apply(app)
	if err != nil {
		t.Fatal(err)
	}
	if summary.Categories+summary.CheckTypes+summary.Locations != 0 {
		t.Fatalf("second run created %+v", summary)
	}
	if n, _ := app.CountRecords("categories"); n != 2 {
		t.Fatalf("categories: %d", n)
	}
}

func TestApplyKeepsWhatIsThereAndAddsWhatIsMissing(t *testing.T) {
	app := testenv.New(t)
	testenv.Create(t, app, "categories", map[string]any{"name": "Atemschutzmasken", "max_service_life_years": 10})
	if _, err := defaults.Apply(app); err != nil {
		t.Fatal(err)
	}
	masks, _ := app.FindFirstRecordByData("categories", "name", "Atemschutzmasken")
	if masks.GetInt("max_service_life_years") != 10 {
		t.Fatal("an existing category is left as it is")
	}
	if n, _ := app.CountRecords("check_types"); n != 3 {
		t.Fatalf("the check types of an existing category are still added: %d", n)
	}
}

func TestCreateAdminMakesAnAdminOfEverything(t *testing.T) {
	app := testenv.New(t)
	if _, err := defaults.Apply(app); err != nil {
		t.Fatal(err)
	}
	password, err := defaults.CreateAdmin(app, "chef@example.com", "Chef", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(password) < 16 {
		t.Fatalf("a generated password must be long: %q", password)
	}
	user, err := app.FindAuthRecordByEmail("users", "chef@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if !user.ValidatePassword(password) {
		t.Fatal("the returned password does not work")
	}
	holders, _ := admin.List(app)
	if len(holders) != 1 || len(holders[0].Areas) != len(admin.Areas) {
		t.Fatalf("holders %+v", holders)
	}
	permissions, _ := app.FindAllRecords("permissions")
	if len(permissions) != 2 {
		t.Fatalf("manage on both categories expected, got %d", len(permissions))
	}
	for _, p := range permissions {
		if p.GetString("level") != "manage" {
			t.Fatalf("level %s", p.GetString("level"))
		}
	}
}

func TestCreateAdminKeepsAnExistingUserAndItsPassword(t *testing.T) {
	app := testenv.New(t)
	testenv.User(t, app, "chef@example.com", "Chef")
	password, err := defaults.CreateAdmin(app, "chef@example.com", "Chef", "")
	if err != nil {
		t.Fatal(err)
	}
	if password != "" {
		t.Fatal("an existing user's password is neither changed nor shown")
	}
	if n, _ := app.CountRecords("users"); n != 1 {
		t.Fatalf("users: %d", n)
	}
}

func TestCreateAdminTakesAGivenPassword(t *testing.T) {
	app := testenv.New(t)
	password, err := defaults.CreateAdmin(app, "chef@example.com", "Chef", "my-long-password-1")
	if err != nil {
		t.Fatal(err)
	}
	user, _ := app.FindAuthRecordByEmail("users", "chef@example.com")
	if password != "my-long-password-1" || !user.ValidatePassword(password) {
		t.Fatal("the given password is used")
	}
}

func TestApplyIfEmptyAppliesOnAnEmptyDatabase(t *testing.T) {
	app := testenv.New(t)
	summary, applied, err := defaults.ApplyIfEmpty(app)
	if err != nil || !applied {
		t.Fatalf("applied %v, err %v", applied, err)
	}
	if summary.Categories != 2 {
		t.Fatalf("summary %+v", summary)
	}
}

func TestApplyIfEmptyLeavesADatabaseWithCategoriesAlone(t *testing.T) {
	app := testenv.New(t)
	testenv.Create(t, app, "categories", map[string]any{"name": "Eigene"})
	_, applied, err := defaults.ApplyIfEmpty(app)
	if err != nil || applied {
		t.Fatalf("applied %v, err %v", applied, err)
	}
	if n, _ := app.CountRecords("categories"); n != 1 {
		t.Fatalf("categories: %d", n)
	}
}

func TestEnabledReadsTheEnvironment(t *testing.T) {
	for value, want := range map[string]bool{"true": true, "1": true, "TRUE": true, "false": false, "": false, "no": false} {
		t.Setenv("APPLY_DEFAULTS", value)
		if got := defaults.Enabled(); got != want {
			t.Errorf("APPLY_DEFAULTS=%q: got %v, want %v", value, got, want)
		}
	}
}
