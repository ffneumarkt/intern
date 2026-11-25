package admin_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/charmbracelet/log"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/ffneumarkt/intern/backend/internal/admin"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

// routeEnv serves the admin routes of a test app.
type routeEnv struct {
	t    *testing.T
	app  *tests.TestApp
	mux  http.Handler
	logs *bytes.Buffer
}

func newRouteEnv(t *testing.T) *routeEnv {
	t.Helper()
	app := testenv.New(t)
	router, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	logs := &bytes.Buffer{}
	admin.RegisterRoutes(&core.ServeEvent{App: app, Router: router}, log.New(logs))
	mux, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	return &routeEnv{t: t, app: app, mux: mux, logs: logs}
}

// do sends a JSON request as the user (anonymous when nil) and decodes a JSON answer into out.
func (e *routeEnv) do(as *core.Record, method, url, body string, out any) *httptest.ResponseRecorder {
	e.t.Helper()
	req := httptest.NewRequest(method, url, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if as != nil {
		req.Header.Set("Authorization", testenv.Token(e.t, as))
	}
	rec := httptest.NewRecorder()
	e.mux.ServeHTTP(rec, req)
	if out != nil && rec.Body.Len() > 0 {
		if err := json.Unmarshal(rec.Body.Bytes(), out); err != nil {
			e.t.Fatalf("%s %s: %v: %s", method, url, err, rec.Body.String())
		}
	}
	return rec
}

func (e *routeEnv) admin(email string, areas ...string) *core.Record {
	e.t.Helper()
	return testenv.Admin(e.t, e.app, testenv.User(e.t, e.app, email, email), areas...)
}
