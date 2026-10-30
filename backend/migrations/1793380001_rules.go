package migrations

import (
	"fmt"
	"strings"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(setRules, clearRules)
}

const (
	anyone   = ""
	loggedIn = `@request.auth.id != ""`
	own      = `user = @request.auth.id`
	asOwner  = `@request.body.user = @request.auth.id`
)

type rules struct {
	list, view, create, update, remove *string
}

func rule(parts ...string) *string {
	return types.Pointer(strings.Join(parts, " && "))
}

func either(a, b string) string {
	return "(" + a + " || " + b + ")"
}

// perm requires a permission row of the current user on category with one of the levels. All
// conditions on @collection.permissions in a rule match the same row.
func perm(category string, levels ...string) string {
	var options []string
	for _, level := range levels {
		options = append(options, fmt.Sprintf("@collection.permissions.level ?= %q", level))
	}
	return fmt.Sprintf("(@collection.permissions.user ?= @request.auth.id && @collection.permissions.category ?= %s && (%s))",
		category, strings.Join(options, " || "))
}

func anyLevel(category string) string {
	return perm(category, "use", "check", "manage")
}

func unchanged(fields ...string) string {
	var parts []string
	for _, field := range fields {
		parts = append(parts, fmt.Sprintf("@request.body.%s:changed = false", field))
	}
	return strings.Join(parts, " && ")
}

func readable(rule *string) rules {
	return rules{list: rule, view: rule}
}

func collectionRules() map[string]rules {
	canSee := func(category string) *string { return rule(anyLevel(category)) }
	manage := perm("category", "manage")
	retiring := `@request.body.status = "retired"`
	ownRecord := rules{list: rule(own), view: rule(own), create: rule(asOwner), update: rule(own, unchanged("user")), remove: rule(own)}

	checkTypes := readable(canSee("category"))
	checkTypes.create = rule(manage)
	checkTypes.update = rule(manage, unchanged("category"))
	checkTypes.remove = rule(manage)

	items := readable(canSee("category"))
	items.create = rule(manage, `@request.body.status = "active"`)
	items.update = rule(
		unchanged("category"),
		either(unchanged("status"), retiring),
		either(manage, "("+perm("category", "check")+" && "+retiring+" && "+unchanged("name", "serial", "barcode", "manufactured_on", "note")+")"),
	)
	items.remove = rule(manage)

	uses := readable(canSee("item.category"))
	uses.create = rule(anyLevel("item.category"), `@request.body.created_by = @request.auth.id`, `item.status != "retired"`)

	checks := readable(canSee("item.category"))
	checks.create = rule(perm("item.category", "check", "manage"), `@request.body.performed_by = @request.auth.id`,
		`item.status != "retired"`, `check_type.category = item.category`)

	return map[string]rules{
		"categories":                  readable(canSee("id")),
		"permissions":                 readable(rule(own)),
		"check_types":                 checkTypes,
		"items":                       items,
		"uses":                        uses,
		"checks":                      checks,
		"notification_settings":       ownRecord,
		"push_subscriptions":          ownRecord,
		"passkeys":                    {list: rule(own), view: rule(own), update: rule(own, unchanged("user", "credential_id", "public_key", "sign_count", "aaguid")), remove: rule(own)},
		"transport_document_settings": readable(types.Pointer(anyone)),
	}
}

func setRules(app core.App) error {
	for name, r := range collectionRules() {
		collection, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			return err
		}
		collection.ListRule, collection.ViewRule = r.list, r.view
		collection.CreateRule, collection.UpdateRule, collection.DeleteRule = r.create, r.update, r.remove
		if err := app.Save(collection); err != nil {
			return err
		}
	}

	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	// Open by default in PocketBase. Names are visible to logged-in users for the history; the
	// admin creates and removes accounts.
	users.ViewRule = rule(loggedIn)
	users.CreateRule = nil
	users.UpdateRule = rule(`id = @request.auth.id`, unchanged("deactivated"))
	users.DeleteRule = nil
	return app.Save(users)
}

func clearRules(app core.App) error {
	for name := range collectionRules() {
		collection, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			return err
		}
		collection.ListRule, collection.ViewRule, collection.CreateRule, collection.UpdateRule, collection.DeleteRule = nil, nil, nil, nil, nil
		if err := app.Save(collection); err != nil {
			return err
		}
	}

	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	ownUser := `id = @request.auth.id`
	users.ViewRule = rule(ownUser)
	users.CreateRule = types.Pointer(anyone)
	users.UpdateRule = rule(ownUser)
	users.DeleteRule = rule(ownUser)
	return app.Save(users)
}
