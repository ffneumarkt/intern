package devseed_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/ffneumarkt/intern/backend/internal/devseed"
	"github.com/ffneumarkt/intern/backend/internal/material"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

var today = time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC)

func TestSeedCoversEveryState(t *testing.T) {
	app := testenv.New(t)
	if err := devseed.Seed(app, today); err != nil {
		t.Fatal(err)
	}
	user, err := app.FindAuthRecordByEmail("users", "verwendung@ffneumarkt.local")
	if err != nil {
		t.Fatal(err)
	}

	s := tests.ApiScenario{
		Name: "due list", Method: "GET", URL: "/api/material/due",
		Headers:               map[string]string{"Authorization": testenv.Token(t, user)},
		ExpectedStatus:        200,
		ExpectedContent:       []string{"Maske 01"},
		DisableTestAppCleanup: true,
		TestAppFactory:        func(testing.TB) *tests.TestApp { return app },
		BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
			material.RegisterRoutes(e, func() time.Time { return today })
		},
		AfterTestFunc: func(t testing.TB, app *tests.TestApp, res *http.Response) {
			var body struct {
				Items []struct{ Name, Status, State string }
			}
			if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			states, statuses := map[string]int{}, map[string]int{}
			for _, item := range body.Items {
				states[item.State]++
				statuses[item.Status]++
			}
			for _, state := range []string{"overdue", "dueToday", "dueSoon", "ok"} {
				if states[state] == 0 {
					t.Errorf("no item is %s: %+v", state, body.Items)
				}
			}
			for _, status := range []string{"active", "defective", "retired"} {
				if statuses[status] == 0 {
					t.Errorf("no item is %s: %+v", status, body.Items)
				}
			}
		},
	}
	s.Test(t)
}

func TestSeedGivesEachUserItsLevel(t *testing.T) {
	app := testenv.New(t)
	if err := devseed.Seed(app, today); err != nil {
		t.Fatal(err)
	}
	for email, level := range map[string]string{
		"verwendung@ffneumarkt.local": "use",
		"pruefung@ffneumarkt.local":   "check",
		"verwaltung@ffneumarkt.local": "manage",
	} {
		user, err := app.FindAuthRecordByEmail("users", email)
		if err != nil {
			t.Fatal(err)
		}
		permissions, err := app.FindRecordsByFilter("permissions", "user = {:user} && level = {:level}", "", 0, 0,
			map[string]any{"user": user.Id, "level": level})
		if err != nil || len(permissions) != 2 {
			t.Errorf("%s: %d permissions, err %v", email, len(permissions), err)
		}
		if !user.ValidatePassword(devseed.Password) {
			t.Errorf("%s: wrong password", email)
		}
	}
	none, err := app.FindAuthRecordByEmail("users", "keine@ffneumarkt.local")
	if err != nil {
		t.Fatal(err)
	}
	permissions, err := app.FindRecordsByFilter("permissions", "user = {:user}", "", 0, 0, map[string]any{"user": none.Id})
	if err != nil || len(permissions) != 0 {
		t.Errorf("keine: %d permissions, err %v", len(permissions), err)
	}
}

func TestSeedRunsOnce(t *testing.T) {
	app := testenv.New(t)
	if err := devseed.Seed(app, today); err != nil {
		t.Fatal(err)
	}
	before, err := app.CountRecords("items")
	if err != nil {
		t.Fatal(err)
	}
	if err := devseed.Seed(app, today); !errors.Is(err, devseed.ErrAlreadySeeded) {
		t.Fatalf("err = %v", err)
	}
	after, err := app.CountRecords("items")
	if err != nil || after != before {
		t.Errorf("items %d → %d, err %v", before, after, err)
	}
}
