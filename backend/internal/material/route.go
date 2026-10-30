package material

import (
	"cmp"
	"net/http"
	"slices"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/due"
)

const dateFormat = "2006-01-02"

type dueJSON struct {
	Kind        due.Kind  `json:"kind"`
	CheckTypeID string    `json:"checkTypeId,omitempty"`
	Date        string    `json:"date"`
	State       due.State `json:"state"`
}

type itemJSON struct {
	ID             string    `json:"id"`
	CategoryID     string    `json:"categoryId"`
	Name           string    `json:"name"`
	Serial         string    `json:"serial,omitempty"`
	Barcode        string    `json:"barcode,omitempty"`
	ManufacturedOn string    `json:"manufacturedOn,omitempty"`
	Status         string    `json:"status"`
	Note           string    `json:"note,omitempty"`
	State          due.State `json:"state"`
	Dues           []dueJSON `json:"dues"`
}

// RegisterRoutes adds GET /api/material/due, the item list with due dates of the categories the
// current user may see, optionally limited by ?category=.
func RegisterRoutes(se *core.ServeEvent, today func() time.Time) {
	se.Router.GET("/api/material/due", func(e *core.RequestEvent) error {
		categoryIDs, err := permittedCategories(e.App, e.Auth.Id)
		if err != nil {
			return err
		}
		if only := e.Request.URL.Query().Get("category"); only != "" {
			if !slices.Contains(categoryIDs, only) {
				return e.ForbiddenError("", nil)
			}
			categoryIDs = []string{only}
		}

		items, err := loadItems(e.App, categoryIDs, today())
		if err != nil {
			return err
		}
		return e.JSON(http.StatusOK, map[string]any{"items": items})
	}).Bind(apis.RequireAuth())
}

func permittedCategories(app core.App, userID string) ([]string, error) {
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

func loadItems(app core.App, categoryIDs []string, today time.Time) ([]itemJSON, error) {
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

	result := make([]itemJSON, 0, len(items))
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
		result = append(result, toItemJSON(r, computed))
	}
	slices.SortFunc(result, func(a, b itemJSON) int { return cmp.Compare(a.Name, b.Name) })
	return result, nil
}

func toItemJSON(r *core.Record, computed due.Result) itemJSON {
	dues := make([]dueJSON, 0, len(computed.Dues))
	for _, d := range computed.Dues {
		dues = append(dues, dueJSON{Kind: d.Kind, CheckTypeID: d.CheckTypeID, Date: d.Date.Format(dateFormat), State: d.State})
	}
	item := itemJSON{
		ID:         r.Id,
		CategoryID: r.GetString("category"),
		Name:       r.GetString("name"),
		Serial:     r.GetString("serial"),
		Barcode:    r.GetString("barcode"),
		Status:     r.GetString("status"),
		Note:       r.GetString("note"),
		State:      computed.State,
		Dues:       dues,
	}
	if manufactured := calendarDate(r, "manufactured_on"); !manufactured.IsZero() {
		item.ManufacturedOn = manufactured.Format(dateFormat)
	}
	return item
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
