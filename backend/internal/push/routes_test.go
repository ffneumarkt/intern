package push_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/charmbracelet/log"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/notify"
	"github.com/ffneumarkt/intern/backend/internal/push"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

type fakeSender struct {
	users     []string
	delivered int
}

func (f *fakeSender) Send(userID string, _ notify.Message) (int, error) {
	f.users = append(f.users, userID)
	return f.delivered, nil
}

type routeHarness struct {
	t      *testing.T
	env    *env
	mux    http.Handler
	sender *fakeSender
}

func newRouteHarness(t *testing.T, withKeys bool) *routeHarness {
	t.Helper()
	e := newEnv(t)
	router, err := apis.NewRouter(e.app)
	if err != nil {
		t.Fatal(err)
	}
	se := &core.ServeEvent{App: e.app, Router: router}
	sender := &fakeSender{delivered: 1}
	logger := log.New(&bytes.Buffer{})
	if withKeys {
		push.RegisterRoutes(se, push.Keys{Public: "public-key", Private: "private", Subject: "mailto:a@b.at"}, sender, logger)
	} else {
		push.RegisterRoutes(se, push.Keys{}, nil, logger)
	}
	mux, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	return &routeHarness{t: t, env: e, mux: mux, sender: sender}
}

func (h *routeHarness) request(method, path, token, clientIP string, body any) (int, []byte) {
	h.t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		h.t.Fatal(err)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	if clientIP != "" {
		req.Header.Set("CF-Connecting-IP", clientIP)
	}
	if token != "" {
		req.Header.Set("Authorization", token)
	}
	rec := httptest.NewRecorder()
	h.mux.ServeHTTP(rec, req)
	return rec.Code, rec.Body.Bytes()
}

func subscription(endpoint, p256dh string) map[string]any {
	return map[string]any{"endpoint": endpoint, "p256dh": p256dh, "auth": "auth-secret", "deviceLabel": "Pixel"}
}

func (h *routeHarness) rows() []*core.Record {
	h.t.Helper()
	rows, err := h.env.app.FindAllRecords("push_subscriptions", dbx.NewExp("1=1"))
	if err != nil {
		h.t.Fatal(err)
	}
	return rows
}

func TestKeyRouteIsPublic(t *testing.T) {
	h := newRouteHarness(t, true)
	status, body := h.request(http.MethodGet, "/api/push/key", "", "", nil)
	if status != http.StatusOK {
		t.Fatalf("status = %d", status)
	}
	var got struct {
		PublicKey string `json:"publicKey"`
	}
	if err := json.Unmarshal(body, &got); err != nil || got.PublicKey != "public-key" {
		t.Errorf("body = %s", body)
	}
}

func TestKeyRouteWithoutKeys(t *testing.T) {
	h := newRouteHarness(t, false)
	if status, _ := h.request(http.MethodGet, "/api/push/key", "", "", nil); status != http.StatusNotFound {
		t.Errorf("status = %d", status)
	}
}

func TestSubscribeNeedsAuth(t *testing.T) {
	h := newRouteHarness(t, true)
	if status, _ := h.request(http.MethodPost, "/api/push/subscribe", "", "", subscription("https://push.example.com/1", "k")); status != http.StatusUnauthorized {
		t.Errorf("status = %d", status)
	}
}

func TestSubscribeCreates(t *testing.T) {
	h := newRouteHarness(t, true)
	token := testenv.Token(t, h.env.w.Use)
	if status, body := h.request(http.MethodPost, "/api/push/subscribe", token, "", subscription("https://push.example.com/1", "k1")); status != http.StatusNoContent {
		t.Fatalf("status = %d %s", status, body)
	}
	rows := h.rows()
	if len(rows) != 1 {
		t.Fatalf("rows = %d", len(rows))
	}
	r := rows[0]
	if r.GetString("user") != h.env.w.Use.Id || r.GetString("p256dh") != "k1" || r.GetString("auth") != "auth-secret" || r.GetString("device_label") != "Pixel" {
		t.Errorf("row = %v", r.FieldsData())
	}
}

func TestSubscribeTakesOverEndpoint(t *testing.T) {
	h := newRouteHarness(t, true)
	const endpoint = "https://push.example.com/1"
	h.request(http.MethodPost, "/api/push/subscribe", testenv.Token(t, h.env.w.Use), "", subscription(endpoint, "old"))
	if status, body := h.request(http.MethodPost, "/api/push/subscribe", testenv.Token(t, h.env.w.Manage), "", subscription(endpoint, "new")); status != http.StatusNoContent {
		t.Fatalf("status = %d %s", status, body)
	}
	rows := h.rows()
	if len(rows) != 1 {
		t.Fatalf("rows = %d", len(rows))
	}
	if rows[0].GetString("user") != h.env.w.Manage.Id || rows[0].GetString("p256dh") != "new" {
		t.Errorf("row = %v", rows[0].FieldsData())
	}
}

func TestSubscribeRefreshesOwnRow(t *testing.T) {
	h := newRouteHarness(t, true)
	token := testenv.Token(t, h.env.w.Use)
	for _, key := range []string{"a", "b"} {
		if status, body := h.request(http.MethodPost, "/api/push/subscribe", token, "", subscription("https://push.example.com/1", key)); status != http.StatusNoContent {
			t.Fatalf("status = %d %s", status, body)
		}
	}
	rows := h.rows()
	if len(rows) != 1 || rows[0].GetString("p256dh") != "b" {
		t.Errorf("rows = %d", len(rows))
	}
}

func TestSubscribeRejectsHTTP(t *testing.T) {
	h := newRouteHarness(t, true)
	token := testenv.Token(t, h.env.w.Use)
	if status, body := h.request(http.MethodPost, "/api/push/subscribe", token, "", subscription("http://push.example.com/1", "k")); status != http.StatusBadRequest {
		t.Errorf("status = %d %s", status, body)
	}
	if len(h.rows()) != 0 {
		t.Error("row was saved")
	}
}

func TestSubscribeRejectsMissingFields(t *testing.T) {
	h := newRouteHarness(t, true)
	token := testenv.Token(t, h.env.w.Use)
	for _, field := range []string{"endpoint", "p256dh", "auth"} {
		body := subscription("https://push.example.com/1", "k")
		delete(body, field)
		if status, _ := h.request(http.MethodPost, "/api/push/subscribe", token, "", body); status != http.StatusBadRequest {
			t.Errorf("without %s: status = %d", field, status)
		}
	}
}

func TestTestPushCountsDelivered(t *testing.T) {
	h := newRouteHarness(t, true)
	status, body := h.request(http.MethodPost, "/api/push/test", testenv.Token(t, h.env.w.Use), "", nil)
	if status != http.StatusOK || string(bytes.TrimSpace(body)) != `{"delivered":1}` {
		t.Fatalf("status = %d %s", status, body)
	}
	if len(h.sender.users) != 1 || h.sender.users[0] != h.env.w.Use.Id {
		t.Errorf("sent to %v", h.sender.users)
	}
	logs, err := h.env.app.FindAllRecords("notification_log", dbx.NewExp("1=1"))
	if err != nil || len(logs) != 0 {
		t.Errorf("log rows = %d, err = %v", len(logs), err)
	}
}

func TestTestPushNeedsAuth(t *testing.T) {
	h := newRouteHarness(t, true)
	if status, _ := h.request(http.MethodPost, "/api/push/test", "", "", nil); status != http.StatusUnauthorized {
		t.Errorf("status = %d", status)
	}
}

func TestTestPushWithoutKeys(t *testing.T) {
	h := newRouteHarness(t, false)
	if status, _ := h.request(http.MethodPost, "/api/push/test", testenv.Token(t, h.env.w.Use), "", nil); status != http.StatusNotFound {
		t.Errorf("status = %d", status)
	}
}

func TestTestPushIsRateLimited(t *testing.T) {
	h := newRouteHarness(t, true)
	token := testenv.Token(t, h.env.w.Use)
	send := func() int {
		status, _ := h.request(http.MethodPost, "/api/push/test", token, "203.0.113.1", nil)
		return status
	}
	for i := range 5 {
		if status := send(); status != http.StatusOK {
			t.Fatalf("attempt %d: %d", i, status)
		}
	}
	if status := send(); status != http.StatusTooManyRequests {
		t.Errorf("status = %d", status)
	}
}
