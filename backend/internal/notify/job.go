package notify

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/charmbracelet/log"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/due"
	"github.com/ffneumarkt/intern/backend/internal/material"
)

// remindersFrom is the Vienna hour from which timings N > 0 and weekly reminders fire.
const remindersFrom = 7

// Sender delivers a message to all devices of a user and says how many accepted it.
type Sender interface {
	Send(userID string, message Message) (delivered int, err error)
}

// Job sends the notifications that are due. It runs every minute; see Schedule.
type Job struct {
	App    core.App
	Sender Sender
	Logger *log.Logger
}

// Schedule adds the job to the app's cron, every minute. A run still going skips the next one.
func Schedule(job *Job) {
	var running sync.Mutex
	job.App.Cron().MustAdd("notify", "* * * * *", func() {
		if !running.TryLock() {
			job.Logger.Warn("notification job still running, skipping this minute")
			return
		}
		defer running.Unlock()
		job.Run(time.Now())
	})
}

// Run looks at every user once. A user's failure is logged and does not stop the others.
func (j *Job) Run(now time.Time) {
	var userIDs []string
	err := j.App.DB().Select("user").Distinct(true).From("push_subscriptions").OrderBy("user").Column(&userIDs)
	if err != nil {
		j.Logger.Error("notification job: load subscribed users", "err", err)
		return
	}
	for _, id := range userIDs {
		j.runUser(id, now)
	}
}

// fired is one timing that fires for one due date of an item.
type fired struct {
	item, reason, timing string
	dueDate              time.Time
}

func (j *Job) runUser(userID string, now time.Time) {
	defer func() {
		if r := recover(); r != nil {
			j.Logger.Error("notification job: user panicked", "user", userID, "panic", r)
		}
	}()
	if err := j.notifyUser(userID, now); err != nil {
		j.Logger.Error("notification job: user failed", "user", userID, "err", err)
	}
}

func (j *Job) notifyUser(userID string, now time.Time) error {
	user, err := j.App.FindRecordById("users", userID)
	if err != nil {
		return fmt.Errorf("load user: %w", err)
	}
	if user.GetBool("deactivated") {
		return nil
	}

	clock := due.InVienna(now)
	quiet, err := j.quietTime(userID)
	if err != nil {
		return err
	}
	if quiet.Contains(clock.Hour()*60 + clock.Minute()) {
		return nil
	}
	today := due.ViennaDay(now)
	reminders := clock.Hour() >= remindersFrom

	settings, err := j.settings(userID)
	if err != nil {
		return err
	}
	if len(settings) == 0 {
		return nil
	}
	categoryIDs := make([]string, 0, len(settings))
	for id := range settings {
		categoryIDs = append(categoryIDs, id)
	}
	slices.Sort(categoryIDs)
	categories, err := j.App.FindRecordsByIds("categories", categoryIDs)
	if err != nil {
		return fmt.Errorf("load categories: %w", err)
	}
	names := map[string]string{}
	for _, c := range categories {
		names[c.Id] = c.GetString("name")
	}
	dues, err := material.LoadDues(j.App, categoryIDs, today)
	if err != nil {
		return fmt.Errorf("load dues: %w", err)
	}

	sentToday, zeroFired, err := j.history(userID, today)
	if err != nil {
		return err
	}

	var items []FiredItem
	var all []fired
	for _, it := range dues {
		category := it.Record.GetString("category")
		setting := settings[category]
		itemFired := false
		for _, d := range it.Result.Dues {
			reason := Reason(d)
			zeroKey := logKey(it.Record.Id, reason, d.Date, "0", time.Time{})
			for _, timing := range Timings(d, setting, today, reminders, zeroFired[zeroKey]) {
				if sentToday[logKey(it.Record.Id, reason, d.Date, timing, today)] {
					continue
				}
				all = append(all, fired{item: it.Record.Id, reason: reason, timing: timing, dueDate: d.Date})
				// Dues are earliest first, so the first fired one has the most urgent state.
				if !itemFired {
					itemFired = true
					items = append(items, FiredItem{ID: it.Record.Id, Category: names[category], State: d.State})
				}
			}
		}
	}
	if len(items) == 0 {
		return nil
	}

	delivered, err := j.Sender.Send(userID, BuildMessage(items))
	if err != nil {
		return fmt.Errorf("send: %w", err)
	}
	if delivered == 0 {
		j.Logger.Warn("notification job: no device accepted the message, retrying next run", "user", userID)
		return nil
	}

	logs, err := j.App.FindCollectionByNameOrId("notification_log")
	if err != nil {
		return fmt.Errorf("load notification_log: %w", err)
	}
	for _, f := range all {
		row := core.NewRecord(logs)
		row.Set("user", userID)
		row.Set("item", f.item)
		row.Set("reason", f.reason)
		row.Set("due_date", f.dueDate)
		row.Set("timing", f.timing)
		row.Set("sent_on", today)
		if err := j.App.Save(row); err != nil {
			if strings.Contains(err.Error(), "UNIQUE constraint failed") {
				j.Logger.Debug("notification job: already logged", "user", userID, "item", f.item, "timing", f.timing)
				continue
			}
			j.Logger.Warn("notification job: save log row", "user", userID, "item", f.item, "timing", f.timing, "err", err)
		}
	}
	return nil
}

// quietTime returns the user's quiet time, the default without a preferences row.
func (j *Job) quietTime(userID string) (QuietTime, error) {
	rows, err := j.App.FindAllRecords("notification_preferences", dbx.HashExp{"user": userID})
	if err != nil {
		return QuietTime{}, fmt.Errorf("load preferences: %w", err)
	}
	if len(rows) == 0 {
		return DefaultQuietTime, nil
	}
	from, until := rows[0].GetString("quiet_from"), rows[0].GetString("quiet_until")
	q := ParseQuietTime(from, until)
	if (from != "" || until != "") && q.From == q.Until {
		j.Logger.Warn("notification job: stored quiet time is invalid, using none",
			"user", userID, "quiet_from", from, "quiet_until", until)
	}
	return q, nil
}

// settings returns one Setting per category the user has permission for. A row with unusable
// timings, which only a hand edit in /_/ can store, is logged and left out.
func (j *Job) settings(userID string) (map[string]Setting, error) {
	rows, err := j.App.FindAllRecords("notification_settings", dbx.HashExp{"user": userID})
	if err != nil {
		return nil, fmt.Errorf("load settings: %w", err)
	}
	permitted, err := material.PermittedCategories(j.App, userID)
	if err != nil {
		return nil, fmt.Errorf("load permissions: %w", err)
	}
	out := map[string]Setting{}
	for _, r := range rows {
		category := r.GetString("category")
		if !slices.Contains(permitted, category) {
			continue
		}
		timings, err := parseTimings(r.Get("timings"))
		if err != nil {
			j.Logger.Warn("notification job: ignoring settings row with invalid timings",
				"user", userID, "category", category, "err", err)
			continue
		}
		out[category] = Setting{Timings: timings, WeeklyOverdue: r.GetBool("weekly_overdue")}
	}
	return out, nil
}

// parseTimings reads a timings JSON value. Null or empty gives no timings.
func parseTimings(value any) ([]int, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	var days []float64
	if err := json.Unmarshal(raw, &days); err != nil {
		return nil, fmt.Errorf("%s is not a list of days", raw)
	}
	out := make([]int, 0, len(days))
	for _, d := range days {
		if d != float64(int(d)) || d < 0 {
			return nil, fmt.Errorf("%s holds %v, not a whole day", raw, d)
		}
		out = append(out, int(d))
	}
	return out, nil
}

// history returns the user's log keys sent today and the zero keys (item, reason, due date) that
// fired on any day.
func (j *Job) history(userID string, today time.Time) (sentToday, zeroFired map[string]bool, err error) {
	rows, err := j.App.FindAllRecords("notification_log",
		dbx.HashExp{"user": userID},
		dbx.Or(dbx.HashExp{"timing": "0"}, dbx.HashExp{"sent_on": dateValue(today)}))
	if err != nil {
		return nil, nil, fmt.Errorf("load notification_log: %w", err)
	}
	sentToday, zeroFired = map[string]bool{}, map[string]bool{}
	for _, r := range rows {
		item, reason, timing := r.GetString("item"), r.GetString("reason"), r.GetString("timing")
		dueDate := calendarDate(r, "due_date")
		sentOn := calendarDate(r, "sent_on")
		if sentOn.Equal(today) {
			sentToday[logKey(item, reason, dueDate, timing, today)] = true
		}
		if timing == "0" {
			zeroFired[logKey(item, reason, dueDate, "0", time.Time{})] = true
		}
	}
	return sentToday, zeroFired, nil
}

func logKey(item, reason string, dueDate time.Time, timing string, sentOn time.Time) string {
	return strings.Join([]string{item, reason, dueDate.Format(time.DateOnly), timing, sentOn.Format(time.DateOnly)}, "|")
}

// dateValue is how a date field stores a calendar date.
func dateValue(d time.Time) string {
	return d.UTC().Format("2006-01-02 15:04:05.000Z")
}

// calendarDate reads a date field stored at 00:00 UTC as a calendar date.
func calendarDate(r *core.Record, field string) time.Time {
	y, m, d := r.GetDateTime(field).Time().UTC().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}
