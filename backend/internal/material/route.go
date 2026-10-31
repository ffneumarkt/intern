package material

import (
	"cmp"
	"net/http"
	"slices"
	"time"

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
		categoryIDs, err := PermittedCategories(e.App, e.Auth.Id)
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

func loadItems(app core.App, categoryIDs []string, today time.Time) ([]itemJSON, error) {
	loaded, err := LoadDues(app, categoryIDs, today)
	if err != nil {
		return nil, err
	}
	result := make([]itemJSON, 0, len(loaded))
	for _, l := range loaded {
		result = append(result, toItemJSON(l.Record, l.Result))
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
