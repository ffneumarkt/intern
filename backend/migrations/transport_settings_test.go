package migrations_test

import (
	"encoding/json"
	"testing"

	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

// A fresh install must be able to build the Beförderungspapier without editing anything first.
func TestTransportSettingsDefaultRecord(t *testing.T) {
	app := testenv.New(t)
	records, err := app.FindAllRecords("transport_document_settings")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("want one default record, got %d", len(records))
	}
	r := records[0]
	for field, want := range map[string]any{
		"station_name":                "FF Neumarkt",
		"station_street":              "Edlwies 3",
		"station_postal_code":         "4212",
		"station_town":                "Neumarkt im Mühlkreis",
		"cylinder_label":              "6,8",
		"filling_station_name":        "FF Grünbach",
		"filling_station_street":      "Freiwaldstraße 15",
		"filling_station_postal_code": "4264",
		"filling_station_town":        "Grünbach bei Freistadt",
	} {
		if got := r.Get(field); got != want {
			t.Errorf("%s = %#v, want %#v", field, got, want)
		}
	}
	if r.GetInt("cylinder_litres_tenths") != 68 || r.GetInt("points_limit") != 1000 {
		t.Errorf("cylinder tenths %d, points limit %d", r.GetInt("cylinder_litres_tenths"), r.GetInt("points_limit"))
	}
	var checklist []string
	if err := json.Unmarshal([]byte(r.GetString("checklist")), &checklist); err != nil || len(checklist) != 5 {
		t.Errorf("checklist = %q (%v)", r.GetString("checklist"), err)
	}
}
