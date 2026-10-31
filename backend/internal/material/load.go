package material

import (
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/due"
)

// ItemDues is an item with its computed due dates.
type ItemDues struct {
	Record *core.Record
	Result due.Result
}

// PermittedCategories returns the ids of the categories the user has any permission on.
func PermittedCategories(app core.App, userID string) ([]string, error) {
	permissions, err := app.FindAllRecords("permissions", dbx.HashExp{"user": userID})
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(permissions))
	for _, p := range permissions {
		ids = append(ids, p.GetString("category"))
	}
	return ids, nil
}

// LoadDues returns the items of the given categories with their computed due dates.
func LoadDues(app core.App, categoryIDs []string, today time.Time) ([]ItemDues, error) {
	categories, err := app.FindRecordsByIds("categories", categoryIDs)
	if err != nil {
		return nil, err
	}
	serviceLife := map[string]int{}
	for _, c := range categories {
		serviceLife[c.Id] = c.GetInt("max_service_life_years")
	}

	inCategory := dbx.In("category", toAny(categoryIDs)...)
	checkTypes, err := app.FindAllRecords("check_types", inCategory)
	if err != nil {
		return nil, err
	}
	typesByCategory := map[string][]due.CheckType{}
	for _, r := range checkTypes {
		category := r.GetString("category")
		typesByCategory[category] = append(typesByCategory[category], due.CheckType{
			ID:             r.Id,
			IntervalMonths: r.GetInt("interval_months"),
			AfterUse:       r.GetBool("after_use"),
			AlsoSatisfies:  r.GetStringSlice("also_satisfies"),
		})
	}

	items, err := app.FindAllRecords("items", inCategory)
	if err != nil {
		return nil, err
	}
	itemIDs := make([]string, 0, len(items))
	for _, r := range items {
		itemIDs = append(itemIDs, r.Id)
	}
	ofItems := dbx.In("item", toAny(itemIDs)...)

	checks, err := app.FindAllRecords("checks", ofItems)
	if err != nil {
		return nil, err
	}
	checksByItem := map[string][]due.Check{}
	for _, r := range checks {
		item := r.GetString("item")
		checksByItem[item] = append(checksByItem[item], due.Check{
			CheckTypeID: r.GetString("check_type"),
			Result:      r.GetString("result"),
			Date:        calendarDate(r, "date"),
		})
	}

	uses, err := app.FindAllRecords("uses", ofItems)
	if err != nil {
		return nil, err
	}
	usesByItem := map[string][]time.Time{}
	for _, r := range uses {
		item := r.GetString("item")
		usesByItem[item] = append(usesByItem[item], calendarDate(r, "date"))
	}

	result := make([]ItemDues, 0, len(items))
	for _, r := range items {
		category := r.GetString("category")
		computed := due.Compute(due.Input{
			Item: due.Item{
				Status:           r.GetString("status"),
				Created:          due.ViennaDay(r.GetDateTime("created").Time()),
				ManufacturedOn:   calendarDate(r, "manufactured_on"),
				ServiceLifeYears: serviceLife[category],
			},
			CheckTypes: typesByCategory[category],
			Checks:     checksByItem[r.Id],
			Uses:       usesByItem[r.Id],
		}, today)
		result = append(result, ItemDues{Record: r, Result: computed})
	}
	return result, nil
}

// calendarDate reads a date field. Date-only input is stored at 00:00 UTC, so the UTC date is the
// calendar date; the zero time means unset.
func calendarDate(r *core.Record, field string) time.Time {
	value := r.GetDateTime(field)
	if value.IsZero() {
		return time.Time{}
	}
	y, m, d := value.Time().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func toAny(values []string) []any {
	result := make([]any, len(values))
	for i, v := range values {
		result[i] = v
	}
	return result
}
