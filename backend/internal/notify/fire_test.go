package notify

import (
	"slices"
	"testing"
	"time"

	"github.com/ffneumarkt/intern/backend/internal/due"
)

func day(s string) time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		panic(err)
	}
	return t
}

func TestTimings(t *testing.T) {
	today := day("2026-10-31")
	full := Setting{Timings: []int{14, 3, 0}, WeeklyOverdue: true}
	tests := []struct {
		name      string
		date      string
		setting   Setting
		reminders bool
		zeroFired bool
		want      []string
	}{
		{"14 days ahead", "2026-11-14", full, true, false, []string{"14"}},
		{"14 days ahead before 07:00", "2026-11-14", full, false, false, nil},
		{"13 days ahead", "2026-11-13", full, true, false, nil},
		{"today before 07:00", "2026-10-31", full, false, false, []string{"0"}},
		{"today already fired", "2026-10-31", full, true, true, nil},
		{"yesterday before 07:00", "2026-10-30", full, false, false, []string{"0"}},
		{"7 days overdue", "2026-10-24", full, true, true, []string{"overdue"}},
		{"7 days overdue, zero not fired", "2026-10-24", full, true, false, []string{"0", "overdue"}},
		{"7 days overdue before 07:00", "2026-10-24", full, false, true, nil},
		{"6 days overdue", "2026-10-25", full, true, true, nil},
		{"overdue without timing 0", "2026-10-30", Setting{Timings: []int{3}}, true, false, nil},
		{"no weekly overdue", "2026-10-24", Setting{Timings: []int{3}}, true, false, nil},
		{"empty setting", "2026-10-24", Setting{}, true, false, nil},
		{"empty setting ahead", "2026-11-03", Setting{}, true, false, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Timings(due.Due{Date: day(tt.date)}, tt.setting, today, tt.reminders, tt.zeroFired)
			if !slices.Equal(got, tt.want) {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestQuietTime(t *testing.T) {
	minute := func(s string) int { return ParseQuietTime(s, s).From }
	tests := []struct {
		q    QuietTime
		at   string
		want bool
	}{
		{DefaultQuietTime, "21:59", false},
		{DefaultQuietTime, "22:00", true},
		{DefaultQuietTime, "23:30", true},
		{DefaultQuietTime, "00:00", true},
		{DefaultQuietTime, "06:59", true},
		{DefaultQuietTime, "07:00", false},
		{ParseQuietTime("13:00", "15:00"), "13:00", true},
		{ParseQuietTime("13:00", "15:00"), "15:00", false},
		{ParseQuietTime("", ""), "00:00", false},
		{ParseQuietTime("", ""), "12:00", false},
	}
	for _, tt := range tests {
		if got := tt.q.Contains(minute(tt.at)); got != tt.want {
			t.Errorf("%+v at %s: got %v, want %v", tt.q, tt.at, got, tt.want)
		}
	}
	if got := ParseQuietTime("22:00", "07:00"); got != DefaultQuietTime {
		t.Errorf("got %+v", got)
	}
}

func TestReason(t *testing.T) {
	tests := []struct {
		d    due.Due
		want string
	}{
		{due.Due{Kind: due.KindCheck, CheckTypeID: "abc"}, "check:abc"},
		{due.Due{Kind: due.KindEndOfLife}, "end_of_life"},
		{due.Due{Kind: due.KindDefect}, "defect"},
	}
	for _, tt := range tests {
		if got := Reason(tt.d); got != tt.want {
			t.Errorf("got %q, want %q", got, tt.want)
		}
	}
}
