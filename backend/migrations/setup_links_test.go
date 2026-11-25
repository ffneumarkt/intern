package migrations_test

import (
	"testing"

	"github.com/ffneumarkt/intern/backend/internal/admin"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

func TestSetupLinksAreClosedToTheAPI(t *testing.T) {
	e := newRulesEnv(t)
	holder := testenv.Admin(t, e.app, testenv.User(t, e.app, "holder@example.com", "Holder"), admin.Members)
	if _, err := e.app.FindCollectionByNameOrId("setup_links"); err != nil {
		t.Fatal(err)
	}
	e.run(t, "list", request{as: holder, method: "GET", url: records("setup_links"), status: 403})
	e.run(t, "create", request{as: holder, method: "POST", url: records("setup_links"), body: `{}`, status: 403})
}

func TestSetupRoutesAreRateLimited(t *testing.T) {
	app := testenv.New(t)
	for _, rule := range app.Settings().RateLimits.Rules {
		if rule.Label == "/api/setup/" && rule.MaxRequests == 10 && rule.Duration == 60 {
			return
		}
	}
	t.Fatal("no rate limit rule for /api/setup/")
}
