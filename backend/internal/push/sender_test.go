package push_test

import (
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/charmbracelet/log"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/ffneumarkt/intern/backend/internal/notify"
	"github.com/ffneumarkt/intern/backend/internal/push"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

type env struct {
	t      *testing.T
	app    *tests.TestApp
	w      *testenv.World
	server *httptest.Server
	sender *push.Sender

	mu         sync.Mutex
	auth       map[string]string // path -> Authorization header
	statusFor  map[string]int
	statusDflt int
}

func newEnv(t *testing.T) *env {
	t.Helper()
	e := &env{t: t, app: testenv.New(t), auth: map[string]string{}, statusFor: map[string]int{}, statusDflt: http.StatusCreated}
	e.w = testenv.Seed(t, e.app)
	e.server = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		e.mu.Lock()
		e.auth[r.URL.Path] = r.Header.Get("Authorization")
		status, ok := e.statusFor[r.URL.Path]
		e.mu.Unlock()
		if !ok {
			status = e.statusDflt
		}
		w.WriteHeader(status)
	}))
	t.Cleanup(e.server.Close)
	private, public, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		t.Fatal(err)
	}
	e.sender = &push.Sender{
		App:    e.app,
		Keys:   push.Keys{Public: public, Private: private, Subject: "mailto:intern@example.com"},
		Client: e.server.Client(),
		Logger: log.New(testWriter{t}),
	}
	return e
}

type testWriter struct{ t *testing.T }

func (w testWriter) Write(p []byte) (int, error) { w.t.Log(strings.TrimSpace(string(p))); return len(p), nil }

func (e *env) subscribe(userID, path string) string {
	e.t.Helper()
	key, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		e.t.Fatal(err)
	}
	authSecret := make([]byte, 16)
	if _, err := rand.Read(authSecret); err != nil {
		e.t.Fatal(err)
	}
	enc := base64.RawURLEncoding
	r := testenv.Create(e.t, e.app, "push_subscriptions", map[string]any{
		"user":     userID,
		"endpoint": e.server.URL + path,
		"p256dh":   enc.EncodeToString(key.PublicKey().Bytes()),
		"auth":     enc.EncodeToString(authSecret),
	})
	return r.Id
}

func (e *env) exists(id string) bool {
	_, err := e.app.FindRecordById("push_subscriptions", id)
	return err == nil
}

var msg = notify.Message{Title: "FF Intern", Body: "x", URL: "/material"}

func TestSendReachesEveryDevice(t *testing.T) {
	e := newEnv(t)
	e.subscribe(e.w.Use.Id, "/a")
	e.subscribe(e.w.Use.Id, "/b")
	n, err := e.sender.Send(e.w.Use.Id, msg)
	if err != nil || n != 2 {
		t.Fatalf("delivered %d, err %v", n, err)
	}
	for _, p := range []string{"/a", "/b"} {
		h := e.auth[p]
		if !strings.HasPrefix(h, "vapid ") {
			t.Errorf("%s: authorization %q", p, h)
		}
	}
	// exactly one mailto: scheme in the sub claim
	h := e.auth["/a"]
	token := strings.TrimPrefix(strings.SplitN(h, ",", 2)[0], "vapid t=")
	payload, err := base64.RawURLEncoding.DecodeString(strings.Split(token, ".")[1])
	if err != nil {
		t.Fatal(err)
	}
	var claims struct{ Sub string }
	if err := json.Unmarshal(payload, &claims); err != nil {
		t.Fatal(err)
	}
	if claims.Sub != "mailto:intern@example.com" {
		t.Errorf("sub = %q", claims.Sub)
	}
}

func TestSendRemovesGoneSubscriptions(t *testing.T) {
	e := newEnv(t)
	e.statusFor["/gone"] = http.StatusGone
	e.statusFor["/missing"] = http.StatusNotFound
	a := e.subscribe(e.w.Use.Id, "/gone")
	b := e.subscribe(e.w.Use.Id, "/missing")
	n, err := e.sender.Send(e.w.Use.Id, msg)
	if err != nil || n != 0 {
		t.Fatalf("delivered %d, err %v", n, err)
	}
	if e.exists(a) || e.exists(b) {
		t.Error("gone subscriptions should be deleted")
	}
}

func TestSendKeepsOnOtherErrors(t *testing.T) {
	e := newEnv(t)
	e.statusDflt = http.StatusInternalServerError
	id := e.subscribe(e.w.Use.Id, "/a")
	n, err := e.sender.Send(e.w.Use.Id, msg)
	if err != nil || n != 0 {
		t.Fatalf("delivered %d, err %v", n, err)
	}
	if !e.exists(id) {
		t.Error("subscription should be kept")
	}
}

func TestSendCountsPartialDelivery(t *testing.T) {
	e := newEnv(t)
	e.statusFor["/bad"] = http.StatusInternalServerError
	e.subscribe(e.w.Use.Id, "/bad")
	e.subscribe(e.w.Use.Id, "/good")
	n, err := e.sender.Send(e.w.Use.Id, msg)
	if err != nil || n != 1 {
		t.Fatalf("delivered %d, err %v", n, err)
	}
}

func TestSendOnlyToThatUser(t *testing.T) {
	e := newEnv(t)
	e.subscribe(e.w.Use.Id, "/mine")
	e.subscribe(e.w.Check.Id, "/other")
	n, err := e.sender.Send(e.w.Use.Id, msg)
	if err != nil || n != 1 {
		t.Fatalf("delivered %d, err %v", n, err)
	}
	if _, hit := e.auth["/other"]; hit {
		t.Error("other user's device was contacted")
	}
	rows, _ := e.app.FindAllRecords("push_subscriptions", dbx.HashExp{"user": e.w.Check.Id})
	if len(rows) != 1 {
		t.Error("other user's subscription changed")
	}
}

func TestKeysFromEnv(t *testing.T) {
	t.Setenv("VAPID_PUBLIC_KEY", "pub")
	t.Setenv("VAPID_PRIVATE_KEY", "priv")
	t.Setenv("VAPID_SUBJECT", "mailto:a@b.at")
	keys, ok := push.KeysFromEnv()
	if !ok || keys != (push.Keys{Public: "pub", Private: "priv", Subject: "mailto:a@b.at"}) {
		t.Errorf("keys %+v ok %v", keys, ok)
	}
	t.Setenv("VAPID_SUBJECT", "")
	if _, ok := push.KeysFromEnv(); ok {
		t.Error("ok with missing subject")
	}
}
