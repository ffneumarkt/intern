package migrations_test

import "testing"

func TestLocationRules(t *testing.T) {
	e := newRulesEnv(t)
	w := e.w
	list := records("locations")

	e.run(t, "anyone logged in reads", request{as: w.None, method: "GET", url: list, status: 200, contains: []string{"AS-Werkstatt"}})
	e.run(t, "anonymous sees none", request{method: "GET", url: list, status: 200, lacks: []string{"AS-Werkstatt"}})

	e.run(t, "use level cannot add", request{as: w.Use, method: "POST", url: list, body: `{"name":"RLF"}`, status: 400})
	e.run(t, "check level cannot add", request{as: w.Check, method: "POST", url: list, body: `{"name":"RLF"}`, status: 400})
	e.run(t, "no permission cannot add", request{as: w.None, method: "POST", url: list, body: `{"name":"RLF"}`, status: 400})
	e.run(t, "manage in one category may add", request{as: w.Mixed, method: "POST", url: list, body: `{"name":"RLF"}`, status: 200})
	e.run(t, "manage adds a second", request{as: w.Manage, method: "POST", url: list, body: `{"name":"LAST"}`, status: 200})
	e.run(t, "names are unique", request{as: w.Manage, method: "POST", url: list, body: `{"name":"LAST"}`, status: 400})
	e.run(t, "the default flag is not settable", request{as: w.Manage, method: "POST", url: list, body: `{"name":"Zweite Werkstatt","is_default":true}`, status: 400})

	var rlfID, defaultID string
	all, err := e.app.FindAllRecords("locations")
	if err != nil {
		t.Fatal(err)
	}
	for _, r := range all {
		switch r.GetString("name") {
		case "RLF":
			rlfID = r.Id
		case "AS-Werkstatt":
			defaultID = r.Id
		}
	}
	e.run(t, "manage renames", request{as: w.Manage, method: "PATCH", url: record("locations", rlfID), body: `{"name":"RLF 1"}`, status: 200})
	e.run(t, "use level cannot rename", request{as: w.Use, method: "PATCH", url: record("locations", rlfID), body: `{"name":"x"}`, status: 404})
	e.run(t, "the default flag cannot change", request{as: w.Manage, method: "PATCH", url: record("locations", rlfID), body: `{"is_default":true}`, status: 404})
	e.run(t, "the default is renamed but stays the default", request{as: w.Manage, method: "PATCH", url: record("locations", defaultID), body: `{"name":"Werkstatt"}`, status: 200})
	e.run(t, "use level cannot delete", request{as: w.Use, method: "DELETE", url: record("locations", rlfID), status: 404})
	e.run(t, "the default cannot be deleted", request{as: w.Manage, method: "DELETE", url: record("locations", defaultID), status: 400})
	e.run(t, "manage deletes an unused one", request{as: w.Manage, method: "DELETE", url: record("locations", rlfID), status: 204})
}
