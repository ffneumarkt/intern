// Package devseed fills an empty database with sample data for local development. It is only
// reachable through cmd/seed, which is not part of the image.
package devseed

import (
	"errors"
	"fmt"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// Password is the password of all seeded users.
const Password = "intern-dev-1234"

// ErrAlreadySeeded is returned when the database already holds categories.
var ErrAlreadySeeded = errors.New("database already has categories")

const dateFormat = "2006-01-02"

type seeder struct {
	app     core.App
	today   time.Time
	checker *core.Record
	err     error
}

// Seed creates users of each level, two categories and items in every due state relative to
// today. It needs the record hooks bound, because status changes come from the checks.
func Seed(app core.App, today time.Time) error {
	count, err := app.CountRecords("categories")
	if err != nil {
		return err
	}
	if count > 0 {
		return ErrAlreadySeeded
	}
	return app.RunInTransaction(func(tx core.App) error {
		s := &seeder{app: tx, today: today}
		s.run()
		return s.err
	})
}

func (s *seeder) run() {
	masks := s.create("categories", map[string]any{"name": "Atemschutzmasken", "max_service_life_years": 15})
	regulators := s.create("categories", map[string]any{"name": "Lungenautomaten"})

	s.user("keine", "Keine Berechtigung", "")
	s.user("verwendung", "Stationsrechner", "use", masks, regulators)
	s.user("pruefung", "Prüfer", "check", masks, regulators)
	s.checker = s.user("verwaltung", "Verwalter", "manage", masks, regulators)

	maskCheck := s.create("check_types", map[string]any{"category": s.id(masks), "name": "Maskenprüfung",
		"interval_months": 12, "after_use": true})
	fiveYear := s.create("check_types", map[string]any{"category": s.id(masks), "name": "5-Jahres-Prüfung",
		"interval_months": 60, "also_satisfies": []string{s.id(maskCheck)}})
	regulatorCheck := s.create("check_types", map[string]any{"category": s.id(regulators), "name": "Jahresprüfung",
		"interval_months": 12, "after_use": true})

	// Each mask is due dueIn days from today; the older five year check does not affect that.
	mask := func(number string, dueIn int) *core.Record {
		item := s.create("items", map[string]any{
			"category": s.id(masks), "name": "Maske " + number, "serial": "DR-4711-" + number, "barcode": "M-0" + number,
			"manufactured_on": s.day(-5, 0), "status": "active",
		})
		s.check(item, fiveYear, s.day(-2, 0), "passed", "")
		s.check(item, maskCheck, s.day(-1, dueIn), "passed", "")
		return item
	}
	overdue := mask("01", -9)
	mask("02", 0)
	mask("03", 10)
	mask("04", 228)
	defective := mask("05", -3)
	s.check(defective, maskCheck, s.day(0, -3), "defect", "Ausatemventil undicht")
	s.check(mask("06", 30), maskCheck, s.day(0, -30), "retired", "Lebensdauer erreicht")

	s.create("uses", map[string]any{"item": s.id(overdue), "date": s.day(0, -9), "kind": "operation",
		"recorded_by_name": "Stationsrechner", "note": "Brand Wohnhaus", "created_by": s.id(s.checker)})

	regulator := s.create("items", map[string]any{"category": s.id(regulators), "name": "LA 01", "barcode": "L-001", "status": "active"})
	s.check(regulator, regulatorCheck, s.day(-1, 6), "passed", "")
}

func (s *seeder) day(years, days int) string {
	return s.today.AddDate(years, 0, days).Format(dateFormat)
}

func (s *seeder) id(record *core.Record) string {
	if record == nil {
		return ""
	}
	return record.Id
}

func (s *seeder) create(collection string, data map[string]any) *core.Record {
	if s.err != nil {
		return nil
	}
	c, err := s.app.FindCollectionByNameOrId(collection)
	if err != nil {
		s.err = err
		return nil
	}
	record := core.NewRecord(c)
	record.Load(data)
	if err := s.app.Save(record); err != nil {
		s.err = fmt.Errorf("create %s: %w", collection, err)
		return nil
	}
	return record
}

func (s *seeder) user(login, name, level string, categories ...*core.Record) *core.Record {
	user := s.create("users", map[string]any{"email": login + "@ffneumarkt.local", "name": name, "password": Password})
	for _, category := range categories {
		s.create("permissions", map[string]any{"user": s.id(user), "category": s.id(category), "level": level})
	}
	return user
}

func (s *seeder) check(item, checkType *core.Record, date, result, note string) {
	s.create("checks", map[string]any{"item": s.id(item), "check_type": s.id(checkType), "date": date,
		"result": result, "performed_by": s.id(s.checker), "note": note})
}
