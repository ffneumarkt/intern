package due

import (
	"testing"
	"time"
)

func d(s string) time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		panic(err)
	}
	return t
}

var today = d("2026-10-30")

type want struct {
	kind Kind
	id   string
	date string
}

func TestCompute(t *testing.T) {
	interval12 := CheckType{ID: "a", IntervalMonths: 12}
	afterUse := CheckType{ID: "a", AfterUse: true}
	passed := func(id, date string) Check { return Check{CheckTypeID: id, Result: "passed", Date: d(date)} }
	active := Item{Status: "active", Created: d("2026-10-01")}

	tests := []struct {
		name  string
		in    Input
		state State
		dues  []want
	}{
		{
			name:  "interval only",
			in:    Input{Item: active, CheckTypes: []CheckType{interval12}, Checks: []Check{passed("a", "2026-01-15")}},
			state: StateOK,
			dues:  []want{{KindCheck, "a", "2027-01-15"}},
		},
		{
			name: "first use after the last check",
			in: Input{Item: active, CheckTypes: []CheckType{afterUse}, Checks: []Check{passed("a", "2026-01-01")},
				Uses: []time.Time{d("2026-03-01"), d("2026-02-01")}},
			state: StateOverdue,
			dues:  []want{{KindCheck, "a", "2026-02-01"}},
		},
		{
			name: "use before the check is ignored",
			in: Input{Item: active, CheckTypes: []CheckType{afterUse}, Checks: []Check{passed("a", "2026-02-01")},
				Uses: []time.Time{d("2026-01-01")}},
			state: StateOK,
		},
		{
			name: "check on the day of a use counts as after it",
			in: Input{Item: active, CheckTypes: []CheckType{afterUse}, Checks: []Check{passed("a", "2026-02-01")},
				Uses: []time.Time{d("2026-02-01")}},
			state: StateOK,
		},
		{
			name: "earlier of interval and use",
			in: Input{Item: active, CheckTypes: []CheckType{{ID: "a", IntervalMonths: 1, AfterUse: true}},
				Checks: []Check{passed("a", "2026-01-01")}, Uses: []time.Time{d("2026-01-15")}},
			state: StateOverdue,
			dues:  []want{{KindCheck, "a", "2026-01-15"}},
		},
		{
			name:  "no check is due on creation",
			in:    Input{Item: active, CheckTypes: []CheckType{interval12}},
			state: StateOverdue,
			dues:  []want{{KindCheck, "a", "2026-10-01"}},
		},
		{
			name:  "no check with a later use is due on creation",
			in:    Input{Item: active, CheckTypes: []CheckType{afterUse}, Uses: []time.Time{d("2026-10-20")}},
			state: StateOverdue,
			dues:  []want{{KindCheck, "a", "2026-10-01"}},
		},
		{
			name: "also_satisfies counts as a relevant check",
			in: Input{Item: active,
				CheckTypes: []CheckType{interval12, {ID: "b", AlsoSatisfies: []string{"a"}, IntervalMonths: 60}},
				Checks:     []Check{passed("b", "2026-06-01")}},
			state: StateOK,
			dues:  []want{{KindCheck, "a", "2027-06-01"}, {KindCheck, "b", "2031-06-01"}},
		},
		{
			name: "also_satisfies is not transitive",
			in: Input{Item: active,
				CheckTypes: []CheckType{
					interval12,
					{ID: "b", AlsoSatisfies: []string{"a"}, AfterUse: true},
					{ID: "c", AlsoSatisfies: []string{"b"}, AfterUse: true},
				},
				Checks: []Check{passed("c", "2026-06-01")}},
			state: StateOverdue,
			dues:  []want{{KindCheck, "a", "2026-10-01"}},
		},
		{
			name: "failed checks are not relevant",
			in: Input{Item: active, CheckTypes: []CheckType{interval12}, Checks: []Check{
				passed("a", "2026-01-15"),
				{CheckTypeID: "a", Result: "defect", Date: d("2026-06-01")},
			}},
			state: StateOK,
			dues:  []want{{KindCheck, "a", "2027-01-15"}},
		},
		{
			name: "end of life",
			in: Input{Item: Item{Status: "active", Created: d("2026-10-01"), ManufacturedOn: d("2016-03-01"),
				ServiceLifeYears: 10}},
			state: StateOverdue,
			dues:  []want{{KindEndOfLife, "", "2026-03-01"}},
		},
		{
			name:  "end of life needs both values",
			in:    Input{Item: Item{Status: "active", ManufacturedOn: d("2016-03-01")}},
			state: StateOK,
		},
		{
			name: "defective is due on the latest defect check",
			in: Input{Item: Item{Status: "defective", Created: d("2026-01-01")}, Checks: []Check{
				{CheckTypeID: "a", Result: "defect", Date: d("2026-10-01")},
				{CheckTypeID: "a", Result: "defect", Date: d("2026-09-01")},
			}},
			state: StateOverdue,
			dues:  []want{{KindDefect, "", "2026-10-01"}},
		},
		{
			name:  "defective without a check falls back to creation",
			in:    Input{Item: Item{Status: "defective", Created: d("2026-10-01")}},
			state: StateOverdue,
			dues:  []want{{KindDefect, "", "2026-10-01"}},
		},
		{
			name:  "retired has nothing due",
			in:    Input{Item: Item{Status: "retired", Created: d("2020-01-01")}, CheckTypes: []CheckType{interval12}},
			state: StateOK,
		},
		{
			name:  "nothing applies",
			in:    Input{Item: active},
			state: StateOK,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Compute(tt.in, today)
			if got.State != tt.state {
				t.Errorf("state = %s, want %s", got.State, tt.state)
			}
			if len(got.Dues) != len(tt.dues) {
				t.Fatalf("dues = %+v, want %+v", got.Dues, tt.dues)
			}
			for i, w := range tt.dues {
				g := got.Dues[i]
				if g.Kind != w.kind || g.CheckTypeID != w.id || !g.Date.Equal(d(w.date)) {
					t.Errorf("due %d = %+v, want %+v", i, g, w)
				}
			}
		})
	}
}

func TestStates(t *testing.T) {
	tests := []struct {
		days  int
		state State
	}{
		{-1, StateOverdue},
		{0, StateDueToday},
		{1, StateDueSoon},
		{14, StateDueSoon},
		{15, StateOK},
	}
	for _, tt := range tests {
		last := today.AddDate(0, 0, tt.days).AddDate(-1, 0, 0)
		got := Compute(Input{
			Item:       Item{Status: "active"},
			CheckTypes: []CheckType{{ID: "a", IntervalMonths: 12}},
			Checks:     []Check{{CheckTypeID: "a", Result: "passed", Date: last}},
		}, today)
		if got.State != tt.state || got.Dues[0].State != tt.state {
			t.Errorf("%d days: item %s, due %s, want %s", tt.days, got.State, got.Dues[0].State, tt.state)
		}
	}
}

func TestItemStateIsTheEarliestDue(t *testing.T) {
	got := Compute(Input{
		Item: Item{Status: "active", Created: d("2026-10-01")},
		CheckTypes: []CheckType{
			{ID: "later", IntervalMonths: 12},
			{ID: "sooner", IntervalMonths: 12},
		},
		Checks: []Check{
			{CheckTypeID: "later", Result: "passed", Date: d("2026-10-01")},
			{CheckTypeID: "sooner", Result: "passed", Date: d("2025-11-01")},
		},
	}, today)
	if got.State != StateDueSoon || got.Dues[0].CheckTypeID != "sooner" {
		t.Errorf("got %+v", got)
	}
}

func TestMonthEnds(t *testing.T) {
	got := Compute(Input{
		Item:       Item{Status: "active"},
		CheckTypes: []CheckType{{ID: "a", IntervalMonths: 6}},
		Checks:     []Check{{CheckTypeID: "a", Result: "passed", Date: d("2026-08-31")}},
	}, today)
	if !got.Dues[0].Date.Equal(d("2027-02-28")) {
		t.Errorf("interval due = %s", got.Dues[0].Date)
	}

	got = Compute(Input{
		Item: Item{Status: "active", ManufacturedOn: d("2024-02-29"), ServiceLifeYears: 1},
	}, today)
	if !got.Dues[0].Date.Equal(d("2025-02-28")) {
		t.Errorf("end of life = %s", got.Dues[0].Date)
	}
}

func TestViennaDay(t *testing.T) {
	tests := []struct{ instant, day string }{
		{"2026-10-29T23:30:00Z", "2026-10-30"},
		{"2026-07-15T22:30:00Z", "2026-07-16"},
		{"2026-07-15T21:30:00Z", "2026-07-15"},
	}
	for _, tt := range tests {
		instant, err := time.Parse(time.RFC3339, tt.instant)
		if err != nil {
			t.Fatal(err)
		}
		if got := ViennaDay(instant); !got.Equal(d(tt.day)) {
			t.Errorf("%s = %s, want %s", tt.instant, got, tt.day)
		}
	}
}

func TestInVienna(t *testing.T) {
	tests := []struct{ instant, clock string }{
		{"2026-07-01T22:30:00Z", "00:30"},
		{"2026-01-01T23:30:00Z", "00:30"},
	}
	for _, tt := range tests {
		instant, err := time.Parse(time.RFC3339, tt.instant)
		if err != nil {
			t.Fatal(err)
		}
		got := InVienna(instant)
		if !got.Equal(instant) || got.Format("15:04") != tt.clock {
			t.Errorf("%s = %s, want %s", tt.instant, got, tt.clock)
		}
	}
}
