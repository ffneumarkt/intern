package migrations

import (
	"slices"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(addSetupLinks, removeSetupLinks)
}

const (
	setupLabel    = "/api/setup/"
	setupRequests = 10
)

// addSetupLinks adds the one-time links with which a member sets a first password. Only hashes of the
// tokens are stored, and only the Go routes touch the collection: it has no API rules. The public setup
// routes are rate limited per IP.
func addSetupLinks(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	links := core.NewBaseCollection("setup_links")
	links.Fields.Add(
		&core.RelationField{Name: "user", CollectionId: users.Id, MaxSelect: 1, Required: true, CascadeDelete: true},
		&core.TextField{Name: "token_hash", Required: true},
		&core.DateField{Name: "expires", Required: true},
		&core.BoolField{Name: "used"},
		created(),
	)
	links.AddIndex("idx_setup_links_token_hash", true, "token_hash", "")
	if err := app.Save(links); err != nil {
		return err
	}

	settings := app.Settings()
	settings.RateLimits.Rules = append(settings.RateLimits.Rules,
		core.RateLimitRule{Label: setupLabel, MaxRequests: setupRequests, Duration: rateLimitWindowSeconds})
	return app.Save(settings)
}

func removeSetupLinks(app core.App) error {
	settings := app.Settings()
	settings.RateLimits.Rules = slices.DeleteFunc(settings.RateLimits.Rules, func(r core.RateLimitRule) bool { return r.Label == setupLabel })
	if err := app.Save(settings); err != nil {
		return err
	}
	links, err := app.FindCollectionByNameOrId("setup_links")
	if err != nil {
		return err
	}
	return app.Delete(links)
}
