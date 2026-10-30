package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(enableRateLimits, disableRateLimits)
}

const (
	passwordAttempts       = 5
	passkeyLoginRequests   = 30 // a login is two requests
	rateLimitWindowSeconds = 60
)

// enableRateLimits limits what can be used to guess a password, and the public passkey routes.
// PocketBase's default rules are left out on purpose: a use recorded for many items at once could
// trip their limit on creates.
func enableRateLimits(app core.App) error {
	settings := app.Settings()
	settings.RateLimits.Enabled = true
	settings.RateLimits.Rules = []core.RateLimitRule{
		{Label: "*:authWithPassword", MaxRequests: passwordAttempts, Duration: rateLimitWindowSeconds},
		{Label: "POST /api/passkey/confirm/finish", MaxRequests: passwordAttempts, Duration: rateLimitWindowSeconds},
		{Label: "/api/passkey/login/", MaxRequests: passkeyLoginRequests, Duration: rateLimitWindowSeconds},
	}
	// Limits count per IP, and behind the tunnel every request comes from cloudflared. The container
	// publishes no port, so only Cloudflare can set this header.
	settings.TrustedProxy.Headers = []string{"CF-Connecting-IP"}
	return app.Save(settings)
}

func disableRateLimits(app core.App) error {
	settings := app.Settings()
	settings.RateLimits.Enabled = false
	settings.RateLimits.Rules = nil
	settings.TrustedProxy.Headers = nil
	return app.Save(settings)
}
