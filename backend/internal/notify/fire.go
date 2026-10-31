package notify

import (
	"slices"
	"strconv"
	"time"

	"github.com/ffneumarkt/intern/backend/internal/due"
)

// Setting is a user's notification_settings row for one category.
type Setting struct {
	Timings       []int
	WeeklyOverdue bool
}

// QuietTime is in minutes after midnight; From == Until means none. From is inside, Until is not.
type QuietTime struct{ From, Until int }

var DefaultQuietTime = QuietTime{From: 22 * 60, Until: 7 * 60}

// ParseQuietTime parses "HH:MM" strings. Empty or invalid input gives no quiet time.
func ParseQuietTime(from, until string) QuietTime {
	f, okF := parseMinutes(from)
	u, okU := parseMinutes(until)
	if !okF || !okU {
		return QuietTime{}
	}
	return QuietTime{From: f, Until: u}
}

func parseMinutes(s string) (int, bool) {
	t, err := time.Parse("15:04", s)
	if err != nil {
		return 0, false
	}
	return t.Hour()*60 + t.Minute(), true
}

// Contains says whether a minute after midnight is inside the quiet time.
func (q QuietTime) Contains(minute int) bool {
	switch {
	case q.From == q.Until:
		return false
	case q.From < q.Until:
		return minute >= q.From && minute < q.Until
	default:
		return minute >= q.From || minute < q.Until
	}
}

// Timings returns the log timings that fire for a due date. reminders is false before 07:00.
// zeroFired says whether timing "0" already fired for this due date on any day.
func Timings(d due.Due, s Setting, today time.Time, reminders, zeroFired bool) []string {
	diff := int(d.Date.Sub(today).Hours() / 24)

	var out []string
	if diff <= 0 && slices.Contains(s.Timings, 0) && !zeroFired {
		out = append(out, "0")
	}
	if reminders && diff > 0 && slices.Contains(s.Timings, diff) {
		out = append(out, strconv.Itoa(diff))
	}
	if reminders && s.WeeklyOverdue && diff < 0 && diff%7 == 0 {
		out = append(out, "overdue")
	}
	return out
}

// Reason returns the notification_log reason of a due date.
func Reason(d due.Due) string {
	switch d.Kind {
	case due.KindCheck:
		return "check:" + d.CheckTypeID
	case due.KindEndOfLife:
		return "end_of_life"
	default:
		return "defect"
	}
}
