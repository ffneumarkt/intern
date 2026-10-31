package migrations

import (
	"slices"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(createNotificationPreferences, deleteNotificationPreferences)
}

const (
	testPushLabel = "POST /api/push/test"
	testPushes    = 5
)

// createNotificationPreferences adds the per-user quiet time and limits test pushes, which send
// requests to third-party servers.
func createNotificationPreferences(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	preferences := core.NewBaseCollection("notification_preferences")
	preferences.Fields.Add(
		ownedBy("user", users),
		&core.TextField{Name: "quiet_from"},
		&core.TextField{Name: "quiet_until"},
	)
	preferences.AddIndex("idx_notification_preferences_user", true, "user", "")
	own := rules{list: rule(own), view: rule(own), create: rule(asOwner), update: rule(own, unchanged("user")), remove: rule(own)}
	preferences.ListRule, preferences.ViewRule = own.list, own.view
	preferences.CreateRule, preferences.UpdateRule, preferences.DeleteRule = own.create, own.update, own.remove
	if err := app.Save(preferences); err != nil {
		return err
	}

	settings := app.Settings()
	settings.RateLimits.Rules = append(settings.RateLimits.Rules,
		core.RateLimitRule{Label: testPushLabel, MaxRequests: testPushes, Duration: rateLimitWindowSeconds})
	return app.Save(settings)
}

func deleteNotificationPreferences(app core.App) error {
	settings := app.Settings()
	settings.RateLimits.Rules = slices.DeleteFunc(settings.RateLimits.Rules, func(r core.RateLimitRule) bool {
		return r.Label == testPushLabel
	})
	if err := app.Save(settings); err != nil {
		return err
	}
	preferences, err := app.FindCollectionByNameOrId("notification_preferences")
	if err != nil {
		return err
	}
	return app.Delete(preferences)
}
