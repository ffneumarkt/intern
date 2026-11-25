package admin

import (
	"errors"
	"fmt"
	"slices"
	"sort"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// Holder is a user with the areas they hold.
type Holder struct {
	Email string
	Areas []string
}

func check(areas []string) error {
	if len(areas) == 0 {
		return errors.New("name at least one area: " + fmt.Sprint(Areas))
	}
	for _, area := range areas {
		if !Valid(area) {
			return fmt.Errorf("unknown area %q, use one of %v", area, Areas)
		}
	}
	return nil
}

// Grant gives the user with that email the areas. Areas already held are skipped. Nothing is granted
// when the user or any area is unknown.
func Grant(app core.App, email string, areas ...string) error {
	if err := check(areas); err != nil {
		return err
	}
	user, err := app.FindAuthRecordByEmail("users", email)
	if err != nil {
		return fmt.Errorf("no user with the email %s", email)
	}
	collection, err := app.FindCollectionByNameOrId("admin_rights")
	if err != nil {
		return err
	}
	for _, area := range areas {
		if _, err := app.FindFirstRecordByFilter("admin_rights", "user = {:user} && area = {:area}", dbx.Params{"user": user.Id, "area": area}); err == nil {
			continue
		}
		row := core.NewRecord(collection)
		row.Set("user", user.Id)
		row.Set("area", area)
		if err := app.Save(row); err != nil {
			return err
		}
	}
	return nil
}

// Revoke takes the areas from the user. Areas not held are skipped. It deletes through the app, so the
// guard that keeps the last members holder applies.
func Revoke(app core.App, email string, areas ...string) error {
	if err := check(areas); err != nil {
		return err
	}
	user, err := app.FindAuthRecordByEmail("users", email)
	if err != nil {
		return fmt.Errorf("no user with the email %s", email)
	}
	for _, area := range areas {
		row, err := app.FindFirstRecordByFilter("admin_rights", "user = {:user} && area = {:area}", dbx.Params{"user": user.Id, "area": area})
		if err != nil {
			continue
		}
		if err := app.Delete(row); err != nil {
			return err
		}
	}
	return nil
}

// List returns everyone who holds an area, sorted by email, with the areas in the order of Areas.
func List(app core.App) ([]Holder, error) {
	rows, err := app.FindAllRecords("admin_rights")
	if err != nil {
		return nil, err
	}
	byEmail := map[string][]string{}
	for _, row := range rows {
		user, err := app.FindRecordById("users", row.GetString("user"))
		if err != nil {
			return nil, err
		}
		byEmail[user.Email()] = append(byEmail[user.Email()], row.GetString("area"))
	}
	var holders []Holder
	for email, areas := range byEmail {
		slices.SortFunc(areas, func(a, b string) int { return slices.Index(Areas, a) - slices.Index(Areas, b) })
		holders = append(holders, Holder{Email: email, Areas: areas})
	}
	sort.Slice(holders, func(i, j int) bool { return holders[i].Email < holders[j].Email })
	return holders, nil
}
