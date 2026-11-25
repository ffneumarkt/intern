package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

func TestBlocked(t *testing.T) {
	for _, p := range []string{
		"/_/", "/_/anything", "/_",
		"/api/collections/_superusers/auth-with-password", "/api/collections/_superusers/records",
		"/api/settings", "/api/settings/test/s3", "/api/backups", "/api/backups/x/restore", "/api/logs", "/api/crons",
		"/api/collections", "/api/collections/", "/api/collections/items", "/api/collections/items/truncate",
		"/api/collections/import", "/api/collections/meta/scaffolds",
		"/api//settings", "/api/collections/../settings", "/api/collections/items/../../settings",
	} {
		if !blocked(p) {
			t.Errorf("%s must be blocked", p)
		}
	}
	for _, p := range []string{
		"/api/collections/items/records", "/api/collections/items/records/abc",
		"/api/collections/users/auth-with-password", "/api/collections/users/auth-refresh",
		"/api/material/due", "/api/passkey/login/begin", "/api/push/key", "/api/health", "/api/realtime",
		"/", "/login", "/material", "/assets/app.js", "/api/settingsx",
	} {
		if blocked(p) {
			t.Errorf("%s must stay open", p)
		}
	}
}

func request(remote string, headers map[string]string) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/api/settings", nil)
	r.RemoteAddr = remote
	for k, v := range headers {
		r.Header.Set(k, v)
	}
	return r
}

func TestLocal(t *testing.T) {
	for name, tc := range map[string]struct {
		r     *http.Request
		allow string
		want  bool
	}{
		"loopback v4":              {request("127.0.0.1:5000", nil), "", true},
		"loopback v6":              {request("[::1]:5000", nil), "", true},
		"other address":            {request("10.0.0.5:5000", nil), "", false},
		"loopback behind a proxy":  {request("127.0.0.1:5000", map[string]string{"X-Forwarded-For": "1.2.3.4"}), "", false},
		"loopback via cloudflare":  {request("127.0.0.1:5000", map[string]string{"Cf-Connecting-Ip": "1.2.3.4"}), "", false},
		"loopback with Forwarded":  {request("127.0.0.1:5000", map[string]string{"Forwarded": "for=1.2.3.4"}), "", false},
		"other address, override":  {request("10.0.0.5:5000", nil), "true", true},
		"override needs the value": {request("10.0.0.5:5000", nil), "yes", false},
		"unparsable address":       {request("nonsense", nil), "", false},
	} {
		t.Run(name, func(t *testing.T) {
			t.Setenv("ADMIN_API_ALLOW", tc.allow)
			if got := local(tc.r); got != tc.want {
				t.Errorf("local = %v, want %v", got, tc.want)
			}
		})
	}
}

func shieldScenario(name, method, url string, status int) *tests.ApiScenario {
	return &tests.ApiScenario{
		Name: name, Method: method, URL: url, Body: strings.NewReader("{}"), ExpectedStatus: status,
		ExpectedContent: []string{""},
		BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
			ShieldAdminAPI(e)
		},
	}
}

func TestShieldAnswers404FromOutside(t *testing.T) {
	t.Setenv("ADMIN_API_ALLOW", "")
	shieldScenario("superuser login", http.MethodPost, "/api/collections/_superusers/auth-with-password", 404).Test(t)
	shieldScenario("settings", http.MethodGet, "/api/settings", 404).Test(t)
	shieldScenario("dashboard", http.MethodGet, "/_/", 404).Test(t)
	shieldScenario("health stays", http.MethodGet, "/api/health", 200).Test(t)
}

func TestShieldOverride(t *testing.T) {
	t.Setenv("ADMIN_API_ALLOW", "true")
	// Reaches PocketBase again: settings need a superuser.
	shieldScenario("settings", http.MethodGet, "/api/settings", 401).Test(t)
}
