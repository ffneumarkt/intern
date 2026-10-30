package due

import (
	"slices"
	"time"
	_ "time/tzdata" // the location must load in any image
)

// State is the list state of a due date or an item.
type State string

const (
	StateOverdue  State = "overdue"
	StateDueToday State = "dueToday"
	StateDueSoon  State = "dueSoon"
	StateOK       State = "ok"
)

// Kind says why something is due.
type Kind string

const (
	KindCheck     Kind = "check"
	KindEndOfLife Kind = "endOfLife"
	KindDefect    Kind = "defect"
)

const soonDays = 14

var vienna = mustLoadVienna()

func mustLoadVienna() *time.Location {
	loc, err := time.LoadLocation("Europe/Vienna")
	if err != nil {
		panic(err)
	}
	return loc
}

// CheckType is a kind of check. IntervalMonths 0 means no interval.
type CheckType struct {
	ID             string
	IntervalMonths int
	AfterUse       bool
	AlsoSatisfies  []string
}

// Check is a recorded check. Result is "passed", "defect" or "retired".
type Check struct {
	CheckTypeID string
	Result      string
	Date        time.Time
}

// Item holds what the calculation needs from an item and its category. All dates here and below
// are calendar dates at 00:00 UTC; the zero value means unset.
type Item struct {
	Status           string
	Created          time.Time
	ManufacturedOn   time.Time
	ServiceLifeYears int
}

// Due is one date something is due on.
type Due struct {
	Kind        Kind
	CheckTypeID string
	Date        time.Time
	State       State
}

// Input is everything known about one item.
type Input struct {
	Item       Item
	CheckTypes []CheckType
	Checks     []Check
	Uses       []time.Time
}

// Result holds the item's state and its due dates, earliest first.
type Result struct {
	State State
	Dues  []Due
}

// Compute calculates the due dates of one item.
func Compute(in Input, today time.Time) Result {
	if in.Item.Status == "retired" {
		return Result{State: StateOK}
	}

	var dues []Due
	for _, ct := range in.CheckTypes {
		if date := checkDue(ct, in); !date.IsZero() {
			dues = append(dues, Due{Kind: KindCheck, CheckTypeID: ct.ID, Date: date})
		}
	}
	if !in.Item.ManufacturedOn.IsZero() && in.Item.ServiceLifeYears > 0 {
		date := addMonths(in.Item.ManufacturedOn, in.Item.ServiceLifeYears*12)
		dues = append(dues, Due{Kind: KindEndOfLife, Date: date})
	}
	if in.Item.Status == "defective" {
		dues = append(dues, Due{Kind: KindDefect, Date: defectDate(in)})
	}

	slices.SortStableFunc(dues, func(a, b Due) int { return a.Date.Compare(b.Date) })
	for i := range dues {
		dues[i].State = stateOf(dues[i].Date, today)
	}

	result := Result{State: StateOK, Dues: dues}
	if len(dues) > 0 {
		result.State = dues[0].State
	}
	return result
}

// ViennaDay returns the calendar date of an instant in Europe/Vienna.
func ViennaDay(t time.Time) time.Time {
	y, m, d := t.In(vienna).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// Today returns the current calendar date in Europe/Vienna.
func Today() time.Time {
	return ViennaDay(time.Now())
}

func checkDue(ct CheckType, in Input) time.Time {
	last := lastRelevantCheck(ct, in)
	if last.IsZero() {
		return in.Item.Created
	}

	var date time.Time
	if ct.IntervalMonths > 0 {
		date = addMonths(last, ct.IntervalMonths)
	}
	if ct.AfterUse {
		if use := firstUseAfter(last, in.Uses); !use.IsZero() && (date.IsZero() || use.Before(date)) {
			date = use
		}
	}
	return date
}

// lastRelevantCheck looks at one level of also_satisfies, not further.
func lastRelevantCheck(ct CheckType, in Input) time.Time {
	relevant := []string{ct.ID}
	for _, other := range in.CheckTypes {
		if slices.Contains(other.AlsoSatisfies, ct.ID) {
			relevant = append(relevant, other.ID)
		}
	}

	var last time.Time
	for _, c := range in.Checks {
		if c.Result == "passed" && slices.Contains(relevant, c.CheckTypeID) && c.Date.After(last) {
			last = c.Date
		}
	}
	return last
}

// firstUseAfter is strict: a check on the same day as a use counts as after the use.
func firstUseAfter(check time.Time, uses []time.Time) time.Time {
	var first time.Time
	for _, use := range uses {
		if use.After(check) && (first.IsZero() || use.Before(first)) {
			first = use
		}
	}
	return first
}

func defectDate(in Input) time.Time {
	var latest time.Time
	for _, c := range in.Checks {
		if c.Result == "defect" && c.Date.After(latest) {
			latest = c.Date
		}
	}
	if latest.IsZero() {
		return in.Item.Created
	}
	return latest
}

// addMonths clamps to the end of the month, unlike time.AddDate, which spills into the next one.
func addMonths(date time.Time, months int) time.Time {
	y, m, d := date.Date()
	lastDay := time.Date(y, m+time.Month(months)+1, 0, 0, 0, 0, 0, time.UTC).Day()
	return time.Date(y, m+time.Month(months), min(d, lastDay), 0, 0, 0, 0, time.UTC)
}

func stateOf(date, today time.Time) State {
	switch {
	case date.Before(today):
		return StateOverdue
	case date.Equal(today):
		return StateDueToday
	case !date.After(today.AddDate(0, 0, soonDays)):
		return StateDueSoon
	default:
		return StateOK
	}
}
