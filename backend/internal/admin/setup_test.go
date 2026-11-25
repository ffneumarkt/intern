package admin_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/ffneumarkt/intern/backend/internal/admin"
)

const goodPassword = "a-long-enough-password"

// newLink makes a member and a setup link for them, as an admin would.
func newLink(t *testing.T, e *routeEnv) (token, memberID string) {
	t.Helper()
	boss := e.admin("boss@example.com", admin.Members)
	var out issued
	if rec := e.do(boss, http.MethodPost, "/api/admin/members", `{"name":"Neu","email":"neu@example.com"}`, &out); rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	return out.Token, out.ID
}

func body(token, password string) string {
	return `{"token":"` + token + `","password":"` + password + `"}`
}

func TestCheckShowsTheNameOfAValidLink(t *testing.T) {
	e := newRouteEnv(t)
	token, _ := newLink(t, e)
	var out struct{ Name string }
	rec := e.do(nil, http.MethodPost, "/api/setup/check", `{"token":"`+token+`"}`, &out)
	if rec.Code != 200 || out.Name != "Neu" {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	if got := rec.Header().Get("Referrer-Policy"); got != "no-referrer" {
		t.Fatalf("Referrer-Policy = %q", got)
	}
}

func TestCompleteSetsThePasswordOnce(t *testing.T) {
	e := newRouteEnv(t)
	token, _ := newLink(t, e)
	if rec := e.do(nil, http.MethodPost, "/api/setup/complete", body(token, goodPassword), nil); rec.Code != http.StatusNoContent {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	user, _ := e.app.FindAuthRecordByEmail("users", "neu@example.com")
	if !user.ValidatePassword(goodPassword) {
		t.Fatal("the new password does not work")
	}
	login := e.do(nil, http.MethodPost, "/api/collections/users/auth-with-password", `{"identity":"neu@example.com","password":"`+goodPassword+`"}`, nil)
	if login.Code != 200 {
		t.Fatalf("login: %d %s", login.Code, login.Body)
	}
	if rec := e.do(nil, http.MethodPost, "/api/setup/complete", body(token, "another-long-password"), nil); rec.Code != http.StatusBadRequest {
		t.Fatalf("a used link must be refused: %d", rec.Code)
	}
	if rec := e.do(nil, http.MethodPost, "/api/setup/check", `{"token":"`+token+`"}`, nil); rec.Code != http.StatusBadRequest {
		t.Fatalf("a used link must not check: %d", rec.Code)
	}
}

func TestEveryBadLinkAnswersAlike(t *testing.T) {
	e := newRouteEnv(t)
	token, memberID := newLink(t, e)

	answers := map[string]string{}
	answer := func(name, tok string) {
		rec := e.do(nil, http.MethodPost, "/api/setup/complete", body(tok, goodPassword), nil)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: %d", name, rec.Code)
		}
		answers[name] = rec.Body.String()
	}
	answer("unknown", "not-a-token")
	answer("empty", "")

	// Expired.
	link, _ := e.app.FindFirstRecordByFilter("setup_links", "user = {:u}", map[string]any{"u": memberID})
	link.Set("expires", time.Now().Add(-time.Minute))
	if err := e.app.Save(link); err != nil {
		t.Fatal(err)
	}
	answer("expired", token)

	// Deactivated member with a valid link.
	link.Set("expires", time.Now().Add(time.Hour))
	if err := e.app.Save(link); err != nil {
		t.Fatal(err)
	}
	user, _ := e.app.FindRecordById("users", memberID)
	user.Set("deactivated", true)
	if err := e.app.Save(user); err != nil {
		t.Fatal(err)
	}
	answer("deactivated", token)

	for name, got := range answers {
		if got != answers["unknown"] {
			t.Errorf("%s answers differently: %s vs %s", name, got, answers["unknown"])
		}
	}
}

func TestShortPasswordIsRefusedAndKeepsTheLink(t *testing.T) {
	e := newRouteEnv(t)
	token, _ := newLink(t, e)
	if rec := e.do(nil, http.MethodPost, "/api/setup/complete", body(token, "short"), nil); rec.Code != http.StatusBadRequest {
		t.Fatalf("%d", rec.Code)
	}
	if rec := e.do(nil, http.MethodPost, "/api/setup/complete", body(token, goodPassword), nil); rec.Code != http.StatusNoContent {
		t.Fatalf("the link must still work: %d %s", rec.Code, rec.Body)
	}
}

func TestOnlyTheHashOfTheTokenIsStoredAndNothingIsLogged(t *testing.T) {
	e := newRouteEnv(t)
	token, _ := newLink(t, e)
	e.do(nil, http.MethodPost, "/api/setup/complete", body(token, goodPassword), nil)
	links, _ := e.app.FindAllRecords("setup_links")
	for _, link := range links {
		if strings.Contains(link.GetString("token_hash"), token) || link.GetString("token_hash") == token {
			t.Fatal("the token is stored")
		}
	}
	if strings.Contains(e.logs.String(), token) || strings.Contains(e.logs.String(), goodPassword) {
		t.Fatal("a secret reached the log")
	}
}

func TestSetupRoutesRefuseUnknownFields(t *testing.T) {
	e := newRouteEnv(t)
	token, _ := newLink(t, e)
	if rec := e.do(nil, http.MethodPost, "/api/setup/complete", `{"token":"`+token+`","password":"`+goodPassword+`","user":"x"}`, nil); rec.Code != http.StatusBadRequest {
		t.Fatalf("%d", rec.Code)
	}
}
