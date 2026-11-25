// Package defaults sets up a station: the categories and check types of the equipment, the trucks as
// locations, and optionally the first admin. It is how a staging environment (or a fresh install that wants
// the usual setup) is filled in one step. Everything is idempotent: what exists by name is left as it is,
// only what is missing is added. The transport document settings and the workshop location come from the
// migrations already. The setup itself is the editable file defaults.json.
package defaults

import (
	"crypto/rand"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/admin"
)

//go:embed defaults.json
var setupFile []byte

type checkType struct {
	Name           string   `json:"name"`
	IntervalMonths int      `json:"intervalMonths"`
	AfterUse       bool     `json:"afterUse"`
	IsDefault      bool     `json:"isDefault"`
	Measurements   bool     `json:"measurements"`
	AlsoSatisfies  []string `json:"alsoSatisfies"`
}

type category struct {
	Name                string      `json:"name"`
	MaxServiceLifeYears int         `json:"maxServiceLifeYears"`
	CheckTypes          []checkType `json:"checkTypes"`
}

type setup struct {
	Categories []category `json:"categories"`
	Locations  []string   `json:"locations"`
}

// Summary counts what a run added.
type Summary struct {
	Categories, CheckTypes, Locations int
}

// Apply adds the categories, check types and locations that are missing.
func Apply(app core.App) (Summary, error) {
	var s setup
	if err := json.Unmarshal(setupFile, &s); err != nil {
		return Summary{}, fmt.Errorf("defaults.json: %w", err)
	}
	var summary Summary
	err := app.RunInTransaction(func(tx core.App) error {
		for _, c := range s.Categories {
			record, created, err := ensure(tx, "categories", "name", c.Name, func(r *core.Record) {
				if c.MaxServiceLifeYears > 0 {
					r.Set("max_service_life_years", c.MaxServiceLifeYears)
				}
			})
			if err != nil {
				return err
			}
			if created {
				summary.Categories++
			}
			ids := map[string]string{}
			for _, t := range c.CheckTypes {
				t := t
				var satisfies []string
				for _, name := range t.AlsoSatisfies {
					satisfies = append(satisfies, ids[name])
				}
				typeRecord, made, err := ensureCheckType(tx, record.Id, t.Name, func(r *core.Record) {
					r.Set("interval_months", t.IntervalMonths)
					r.Set("after_use", t.AfterUse)
					r.Set("is_default", t.IsDefault)
					r.Set("measurements", t.Measurements)
					r.Set("also_satisfies", satisfies)
				})
				if err != nil {
					return err
				}
				ids[t.Name] = typeRecord.Id
				if made {
					summary.CheckTypes++
				}
			}
		}
		for _, name := range s.Locations {
			name := name
			_, created, err := ensure(tx, "locations", "name", name, func(*core.Record) {})
			if err != nil {
				return err
			}
			if created {
				summary.Locations++
			}
		}
		return nil
	})
	return summary, err
}

// ensure returns the record of the collection whose field equals value, creating it when missing.
func ensure(app core.App, collection, field, value string, fill func(*core.Record)) (*core.Record, bool, error) {
	if existing, err := app.FindFirstRecordByData(collection, field, value); err == nil {
		return existing, false, nil
	}
	c, err := app.FindCollectionByNameOrId(collection)
	if err != nil {
		return nil, false, err
	}
	record := core.NewRecord(c)
	record.Set(field, value)
	fill(record)
	if err := app.Save(record); err != nil {
		return nil, false, fmt.Errorf("create %s %q: %w", collection, value, err)
	}
	return record, true, nil
}

// ensureCheckType is ensure for a check type, whose name is only unique within its category.
func ensureCheckType(app core.App, categoryID, name string, fill func(*core.Record)) (*core.Record, bool, error) {
	existing, err := app.FindFirstRecordByFilter("check_types", "category = {:c} && name = {:n}", map[string]any{"c": categoryID, "n": name})
	if err == nil {
		return existing, false, nil
	}
	c, err := app.FindCollectionByNameOrId("check_types")
	if err != nil {
		return nil, false, err
	}
	record := core.NewRecord(c)
	record.Set("category", categoryID)
	record.Set("name", name)
	fill(record)
	if err := app.Save(record); err != nil {
		return nil, false, fmt.Errorf("create check type %q: %w", name, err)
	}
	return record, true, nil
}

// CreateAdmin makes the first admin: the user (created with the given password, or a generated one), every
// admin area, and manage on every category. It returns the password it set, empty when the user existed (an
// existing user's password is never changed or shown).
func CreateAdmin(app core.App, email, name, password string) (string, error) {
	if _, err := app.FindAuthRecordByEmail("users", email); err == nil {
		return "", grantAll(app, email)
	}
	if password == "" {
		raw := make([]byte, 18)
		if _, err := rand.Read(raw); err != nil {
			return "", err
		}
		password = base64.RawURLEncoding.EncodeToString(raw)
	}
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return "", err
	}
	user := core.NewRecord(users)
	user.SetEmail(email)
	user.Set("name", name)
	user.SetPassword(password)
	user.SetVerified(true)
	if err := app.Save(user); err != nil {
		return "", fmt.Errorf("create user: %w", err)
	}
	return password, grantAll(app, email)
}

func grantAll(app core.App, email string) error {
	if err := admin.Grant(app, email, admin.Areas...); err != nil {
		return err
	}
	user, err := app.FindAuthRecordByEmail("users", email)
	if err != nil {
		return err
	}
	categories, err := app.FindAllRecords("categories")
	if err != nil {
		return err
	}
	permissions, err := app.FindCollectionByNameOrId("permissions")
	if err != nil {
		return err
	}
	for _, c := range categories {
		if _, err := app.FindFirstRecordByFilter("permissions", "user = {:u} && category = {:c}", map[string]any{"u": user.Id, "c": c.Id}); err == nil {
			continue
		}
		p := core.NewRecord(permissions)
		p.Set("user", user.Id)
		p.Set("category", c.Id)
		p.Set("level", "manage")
		if err := app.Save(p); err != nil {
			return err
		}
	}
	return nil
}

// Enabled reports whether APPLY_DEFAULTS asks for the default setup on the first start.
func Enabled() bool {
	switch strings.ToLower(os.Getenv("APPLY_DEFAULTS")) {
	case "true", "1", "yes":
		return true
	}
	return false
}

// ApplyIfEmpty applies the defaults only when the database has no category yet, so it is safe to leave
// APPLY_DEFAULTS on: a station that has its own categories (or deleted the defaults on purpose after the
// first start and added its own) is never touched. It reports whether it applied them.
func ApplyIfEmpty(app core.App) (Summary, bool, error) {
	count, err := app.CountRecords("categories")
	if err != nil || count > 0 {
		return Summary{}, false, err
	}
	summary, err := Apply(app)
	return summary, err == nil, err
}
