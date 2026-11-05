package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(createTransportSettingsDefault, deleteTransportSettingsDefault)
}

// createTransportSettingsDefault adds the single settings record the Beförderungspapier reads, so a
// fresh install works without editing anything first. An existing record is left as it is.
func createTransportSettingsDefault(app core.App) error {
	collection, err := app.FindCollectionByNameOrId("transport_document_settings")
	if err != nil {
		return err
	}
	existing, err := app.CountRecords(collection.Name)
	if err != nil || existing > 0 {
		return err
	}
	record := core.NewRecord(collection)
	record.Load(map[string]any{
		"station_name":                "FF Neumarkt",
		"station_street":              "Edlwies 3",
		"station_postal_code":         "4212",
		"station_town":                "Neumarkt im Mühlkreis",
		"cylinder_label":              "6,8",
		"cylinder_litres_tenths":      68,
		"points_limit":                1000,
		"filling_station_name":        "FF Grünbach",
		"filling_station_street":      "Freiwaldstraße 15",
		"filling_station_postal_code": "4264",
		"filling_station_town":        "Grünbach bei Freistadt",
		"checklist": []string{
			"Flaschen gegen Rutschen, Rollen und Kippen gesichert",
			"Schutzkappen / Ventilschutz montiert",
			"2-kg-Feuerlöscher an Bord, geprüft und plombiert",
			"Gefahrzettel 2.2 an Flaschen bzw. Transportbox angebracht",
			"Restdruck in allen Flaschen vorhanden",
		},
	})
	return app.Save(record)
}

// The record may have been edited since, so the down migration keeps it.
func deleteTransportSettingsDefault(core.App) error { return nil }
