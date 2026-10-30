package passkey_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/charmbracelet/log"
	"github.com/descope/virtualwebauthn"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/ffneumarkt/intern/backend/internal/passkey"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

const origin = "https://intern.example.com"

var relyingParty = virtualwebauthn.RelyingParty{Name: "FF Intern", ID: "intern.example.com", Origin: origin}

// harness keeps one router, because sessions live between begin and finish.
type harness struct {
	t   *testing.T
	app *tests.TestApp
	w   *testenv.World
	mux http.Handler
	logs *bytes.Buffer
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	app := testenv.New(t)
	w := testenv.Seed(t, app)
	router, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	se := &core.ServeEvent{App: app, Router: router}
	logs := &bytes.Buffer{}
	if err := passkey.Register(se, passkey.Config{RPID: relyingParty.ID, Origins: []string{origin}}, log.New(logs)); err != nil {
		t.Fatal(err)
	}
	mux, err := router.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	return &harness{t: t, app: app, w: w, mux: mux, logs: logs}
}

func (h *harness) post(path, token string, body any) (int, []byte) {
	h.t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		h.t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/passkey/"+path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", token)
	}
	rec := httptest.NewRecorder()
	h.mux.ServeHTTP(rec, req)
	return rec.Code, rec.Body.Bytes()
}

type begun struct {
	SessionID string          `json:"sessionId"`
	Options   json.RawMessage `json:"options"`
}

func (h *harness) begin(path, token string) begun {
	h.t.Helper()
	status, body := h.post(path, token, map[string]any{})
	if status != http.StatusOK {
		h.t.Fatalf("%s: %d %s", path, status, body)
	}
	var b begun
	if err := json.Unmarshal(body, &b); err != nil {
		h.t.Fatal(err)
	}
	return b
}

// device behaves like a synced passkey unless changed.
type device struct {
	auth virtualwebauthn.Authenticator
	cred virtualwebauthn.Credential
}

func newDevice(user *core.Record) *device {
	auth := virtualwebauthn.NewAuthenticator()
	auth.Options.UserHandle = []byte(user.Id)
	auth.Options.BackupEligible = true
	auth.Options.BackupState = true
	return &device{auth: auth, cred: virtualwebauthn.NewCredential(virtualwebauthn.KeyTypeEC2)}
}

func (h *harness) registerBody(user *core.Record, d *device, name string) map[string]any {
	h.t.Helper()
	b := h.begin("register/begin", testenv.Token(h.t, user))
	options, err := virtualwebauthn.ParseAttestationOptions(string(b.Options))
	if err != nil {
		h.t.Fatal(err)
	}
	response := virtualwebauthn.CreateAttestationResponse(relyingParty, d.auth, d.cred, *options)
	return map[string]any{"sessionId": b.SessionID, "name": name, "credential": json.RawMessage(response)}
}

func (h *harness) register(user *core.Record, d *device) {
	h.t.Helper()
	status, body := h.post("register/finish", testenv.Token(h.t, user), h.registerBody(user, d, "Telefon"))
	if status != http.StatusOK {
		h.t.Fatalf("register: %d %s", status, body)
	}
}

func (h *harness) loginBody(d *device) map[string]any {
	h.t.Helper()
	b := h.begin("login/begin", "")
	options, err := virtualwebauthn.ParseAssertionOptions(string(b.Options))
	if err != nil {
		h.t.Fatal(err)
	}
	response := virtualwebauthn.CreateAssertionResponse(relyingParty, d.auth, d.cred, *options)
	return map[string]any{"sessionId": b.SessionID, "credential": json.RawMessage(response)}
}

func (h *harness) login(d *device) (int, []byte) {
	h.t.Helper()
	return h.post("login/finish", "", h.loginBody(d))
}

func (h *harness) passkeyOf(user *core.Record) *core.Record {
	h.t.Helper()
	record, err := h.app.FindFirstRecordByData("passkeys", "user", user.Id)
	if err != nil {
		h.t.Fatal(err)
	}
	return record
}

func wantRefused(t *testing.T, status int, body []byte) {
	t.Helper()
	if status != http.StatusBadRequest || !strings.Contains(string(body), "Failed to authenticate.") {
		t.Errorf("got %d %s", status, body)
	}
}

func TestRegisterAndLogin(t *testing.T) {
	h := newHarness(t)
	d := newDevice(h.w.Use)
	h.register(h.w.Use, d)

	key := h.passkeyOf(h.w.Use)
	if key.GetString("name") != "Telefon" || key.GetString("credential_id") == "" || key.GetString("public_key") == "" ||
		key.GetString("aaguid") == "" || !key.GetBool("backup_eligible") || !key.GetBool("backup_state") {
		t.Errorf("stored %v", key.FieldsData())
	}

	status, body := h.login(d)
	if status != http.StatusOK {
		t.Fatalf("login: %d %s", status, body)
	}
	var auth struct {
		Token  string `json:"token"`
		Record struct {
			ID string `json:"id"`
		} `json:"record"`
	}
	if err := json.Unmarshal(body, &auth); err != nil {
		t.Fatal(err)
	}
	if auth.Token == "" || auth.Record.ID != h.w.Use.Id {
		t.Errorf("response %s", body)
	}
}

func TestSyncedPasskeyLogsInRepeatedly(t *testing.T) {
	h := newHarness(t)
	d := newDevice(h.w.Use)
	h.register(h.w.Use, d)
	for i := range 3 {
		if status, body := h.login(d); status != http.StatusOK {
			t.Fatalf("login %d: %d %s", i, status, body)
		}
	}
}

func TestPasskeyWithoutBackupFlagsWorksToo(t *testing.T) {
	h := newHarness(t)
	d := newDevice(h.w.Use)
	d.auth.Options.BackupEligible = false
	d.auth.Options.BackupState = false
	h.register(h.w.Use, d)
	if status, body := h.login(d); status != http.StatusOK {
		t.Fatalf("%d %s", status, body)
	}
}

func TestSignCountAdvances(t *testing.T) {
	h := newHarness(t)
	d := newDevice(h.w.Use)
	h.register(h.w.Use, d)
	d.cred.Counter = 7
	if status, body := h.login(d); status != http.StatusOK {
		t.Fatalf("%d %s", status, body)
	}
	if got := h.passkeyOf(h.w.Use).GetInt("sign_count"); got < 7 {
		t.Errorf("sign_count = %d", got)
	}
}

func TestSignCountRegressionIsRejected(t *testing.T) {
	h := newHarness(t)
	d := newDevice(h.w.Use)
	h.register(h.w.Use, d)
	key := h.passkeyOf(h.w.Use)
	key.Set("sign_count", 100)
	if err := h.app.Save(key); err != nil {
		t.Fatal(err)
	}
	d.cred.Counter = 5
	status, body := h.login(d)
	wantRefused(t, status, body)
	if got := h.passkeyOf(h.w.Use).GetInt("sign_count"); got != 100 {
		t.Errorf("sign_count = %d", got)
	}
}

func TestDeactivatedUser(t *testing.T) {
	h := newHarness(t)
	d := newDevice(h.w.Use)
	h.register(h.w.Use, d)
	token := testenv.Token(h.t, h.w.Use)

	h.w.Use.Set("deactivated", true)
	if err := h.app.Save(h.w.Use); err != nil {
		t.Fatal(err)
	}
	status, body := h.login(d)
	wantRefused(t, status, body)
	if status, _ := h.post("register/begin", token, map[string]any{}); status != http.StatusUnauthorized {
		t.Errorf("register/begin = %d", status)
	}

	h.w.Use.Set("deactivated", false)
	if err := h.app.Save(h.w.Use); err != nil {
		t.Fatal(err)
	}
	if status, body := h.login(d); status != http.StatusOK {
		t.Errorf("after reactivation: %d %s", status, body)
	}
}

func TestDeactivatedRefusalIsLoggedAndWritesNothing(t *testing.T) {
	h := newHarness(t)
	d := newDevice(h.w.Use)
	h.register(h.w.Use, d)
	h.w.Use.Set("deactivated", true)
	if err := h.app.Save(h.w.Use); err != nil {
		t.Fatal(err)
	}
	d.cred.Counter = 9
	status, body := h.login(d)
	wantRefused(t, status, body)
	if got := h.passkeyOf(h.w.Use).GetInt("sign_count"); got != 0 {
		t.Errorf("sign_count = %d", got)
	}
	if logged := h.logs.String(); !strings.Contains(logged, "deactivated") || !strings.Contains(logged, h.w.Use.Id) {
		t.Errorf("log: %q", logged)
	}
}

func TestRegressionLogNamesTheUser(t *testing.T) {
	h := newHarness(t)
	d := newDevice(h.w.Use)
	h.register(h.w.Use, d)
	key := h.passkeyOf(h.w.Use)
	key.Set("sign_count", 100)
	if err := h.app.Save(key); err != nil {
		t.Fatal(err)
	}
	d.cred.Counter = 5
	h.login(d)
	if logged := h.logs.String(); !strings.Contains(logged, "sign count regression") || !strings.Contains(logged, h.w.Use.Id) {
		t.Errorf("log: %q", logged)
	}
}

func TestRemovedPasskeyStopsWorking(t *testing.T) {
	h := newHarness(t)
	d := newDevice(h.w.Use)
	h.register(h.w.Use, d)
	if err := h.app.Delete(h.passkeyOf(h.w.Use)); err != nil {
		t.Fatal(err)
	}
	status, body := h.login(d)
	wantRefused(t, status, body)
}

func TestCredentialOnlyLogsInAsItsOwner(t *testing.T) {
	h := newHarness(t)
	d := newDevice(h.w.Use)
	h.register(h.w.Use, d)
	d.auth.Options.UserHandle = []byte(h.w.Check.Id)
	status, body := h.login(d)
	wantRefused(t, status, body)
}

func TestUnknownUserHandle(t *testing.T) {
	h := newHarness(t)
	d := newDevice(h.w.Use)
	h.register(h.w.Use, d)
	d.auth.Options.UserHandle = []byte("nope")
	status, body := h.login(d)
	wantRefused(t, status, body)
}

func TestReplayedLoginFinish(t *testing.T) {
	h := newHarness(t)
	d := newDevice(h.w.Use)
	h.register(h.w.Use, d)
	request := h.loginBody(d)
	if status, body := h.post("login/finish", "", request); status != http.StatusOK {
		t.Fatalf("%d %s", status, body)
	}
	status, body := h.post("login/finish", "", request)
	wantRefused(t, status, body)
}

func TestUnknownSession(t *testing.T) {
	h := newHarness(t)
	d := newDevice(h.w.Use)
	h.register(h.w.Use, d)
	request := h.loginBody(d)
	request["sessionId"] = "nope"
	status, body := h.post("login/finish", "", request)
	wantRefused(t, status, body)
}

func TestRegisterFinishBelongsToTheSameUser(t *testing.T) {
	h := newHarness(t)
	request := h.registerBody(h.w.Use, newDevice(h.w.Use), "Telefon")
	status, _ := h.post("register/finish", testenv.Token(h.t, h.w.Check), request)
	if status != http.StatusBadRequest {
		t.Errorf("status = %d", status)
	}
	if n, err := h.app.CountRecords("passkeys"); err != nil || n != 0 {
		t.Errorf("%d passkeys, err %v", n, err)
	}
}

func TestRegisterNeedsAuth(t *testing.T) {
	h := newHarness(t)
	for _, path := range []string{"register/begin", "register/finish"} {
		if status, _ := h.post(path, "", map[string]any{}); status != http.StatusUnauthorized {
			t.Errorf("%s = %d", path, status)
		}
	}
}

func TestExistingCredentialsAreExcluded(t *testing.T) {
	h := newHarness(t)
	h.register(h.w.Use, newDevice(h.w.Use))
	b := h.begin("register/begin", testenv.Token(h.t, h.w.Use))
	var options struct {
		ExcludeCredentials []struct {
			ID string `json:"id"`
		} `json:"excludeCredentials"`
	}
	if err := json.Unmarshal(b.Options, &options); err != nil {
		t.Fatal(err)
	}
	if len(options.ExcludeCredentials) != 1 || options.ExcludeCredentials[0].ID != h.passkeyOf(h.w.Use).GetString("credential_id") {
		t.Errorf("options %s", b.Options)
	}
}

func TestRegistrationAsksForADiscoverableCredential(t *testing.T) {
	h := newHarness(t)
	b := h.begin("register/begin", testenv.Token(h.t, h.w.Use))
	if !strings.Contains(string(b.Options), `"residentKey":"required"`) {
		t.Errorf("options %s", b.Options)
	}
}

func TestMalformedCredential(t *testing.T) {
	h := newHarness(t)
	token := testenv.Token(h.t, h.w.Use)
	register := h.begin("register/begin", token)
	if status, _ := h.post("register/finish", token, map[string]any{"sessionId": register.SessionID, "name": "x", "credential": map[string]any{}}); status != http.StatusBadRequest {
		t.Errorf("register/finish = %d", status)
	}
	login := h.begin("login/begin", "")
	status, body := h.post("login/finish", "", map[string]any{"sessionId": login.SessionID, "credential": map[string]any{}})
	wantRefused(t, status, body)
}

func TestRegisterRequiresAName(t *testing.T) {
	h := newHarness(t)
	request := h.registerBody(h.w.Use, newDevice(h.w.Use), "  ")
	if status, _ := h.post("register/finish", testenv.Token(h.t, h.w.Use), request); status != http.StatusBadRequest {
		t.Errorf("status = %d", status)
	}
}

func TestConfigFromEnv(t *testing.T) {
	cfg := passkey.ConfigFromEnv()
	if cfg.RPID != "intern.ffneumarkt.at" || len(cfg.Origins) != 1 || cfg.Origins[0] != "https://intern.ffneumarkt.at" {
		t.Errorf("defaults %+v", cfg)
	}
	t.Setenv("PASSKEY_RP_ID", "localhost")
	t.Setenv("PASSKEY_ORIGIN", "http://localhost:5173, http://localhost:8090")
	cfg = passkey.ConfigFromEnv()
	if cfg.RPID != "localhost" || len(cfg.Origins) != 2 || cfg.Origins[1] != "http://localhost:8090" {
		t.Errorf("from env %+v", cfg)
	}
}
