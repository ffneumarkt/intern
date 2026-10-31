package material_test

import (
	"testing"
	"time"

	"github.com/ffneumarkt/intern/backend/internal/due"
	"github.com/ffneumarkt/intern/backend/internal/material"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

var today = time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC)

func TestLoadDues(t *testing.T) {
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	testenv.Create(t, app, "checks", map[string]any{"item": w.ItemA.Id, "check_type": w.CheckTypeA.Id,
		"date": "2025-10-21", "result": "passed", "performed_by": w.Check.Id})

	got, err := material.LoadDues(app, []string{w.CategoryA.Id}, today)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Record.Id != w.ItemA.Id {
		t.Fatalf("got %d entries, want only item A", len(got))
	}
	found := false
	for _, d := range got[0].Result.Dues {
		if d.Kind == due.KindCheck && d.CheckTypeID == w.CheckTypeA.Id {
			found = true
		}
	}
	if !found {
		t.Errorf("dues %+v lack the check due of %s", got[0].Result.Dues, w.CheckTypeA.Id)
	}
}

func TestLoadDuesWithoutCategories(t *testing.T) {
	app := testenv.New(t)
	testenv.Seed(t, app)

	got, err := material.LoadDues(app, nil, today)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Errorf("got %d entries, want none", len(got))
	}
}
