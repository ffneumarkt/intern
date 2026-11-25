package server

import (
	"net/http"
	"testing"
	"testing/fstest"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

var testDist = fstest.MapFS{
	"index.html":    {Data: []byte("<p>app shell</p>")},
	"assets/app.js": {Data: []byte("console.log('app')")},
}

func frontendScenario(name, url string, status int) tests.ApiScenario {
	return tests.ApiScenario{
		Name:           name,
		Method:         http.MethodGet,
		URL:            url,
		ExpectedStatus: status,
		BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
			RegisterFrontend(e, testDist)
		},
	}
}

func TestFrontendIndex(t *testing.T) {
	s := frontendScenario("index", "/", 200)
	s.ExpectedContent = []string{"app shell"}
	s.Test(t)
}

func TestFrontendAsset(t *testing.T) {
	s := frontendScenario("asset", "/assets/app.js", 200)
	s.ExpectedContent = []string{"console.log('app')"}
	s.Test(t)
}

func TestFrontendDeepLinkFallback(t *testing.T) {
	s := frontendScenario("deep link", "/material/items/abc", 200)
	s.ExpectedContent = []string{"app shell"}
	s.Test(t)
}

func TestAPINotShadowed(t *testing.T) {
	s := frontendScenario("unknown api path", "/api/does-not-exist", 404)
	s.ExpectedContent = []string{`"status":404`}
	s.NotExpectedContent = []string{"app shell"}
	s.Test(t)
}

func TestHealthStillWorks(t *testing.T) {
	s := frontendScenario("health", "/api/health", 200)
	s.ExpectedContent = []string{`"code":200`}
	s.Test(t)
}

func TestSetupPageSendsNoReferrer(t *testing.T) {
	s := frontendScenario("setup page", "/einrichtung", 200)
	s.ExpectedContent = []string{"app shell"}
	s.AfterTestFunc = func(t testing.TB, app *tests.TestApp, res *http.Response) {
		if got := res.Header.Get("Referrer-Policy"); got != "no-referrer" {
			t.Errorf("Referrer-Policy = %q", got)
		}
	}
	s.Test(t)
}

func TestOtherPagesKeepTheDefaultReferrerPolicy(t *testing.T) {
	s := frontendScenario("index", "/", 200)
	s.ExpectedContent = []string{"app shell"}
	s.AfterTestFunc = func(t testing.TB, app *tests.TestApp, res *http.Response) {
		if got := res.Header.Get("Referrer-Policy"); got != "" {
			t.Errorf("Referrer-Policy = %q, want none", got)
		}
	}
	s.Test(t)
}
