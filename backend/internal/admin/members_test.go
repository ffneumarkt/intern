package admin_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/admin"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

type member struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Email       string   `json:"email"`
	Deactivated bool     `json:"deactivated"`
	Areas       []string `json:"areas"`
}

type issued struct {
	ID      string `json:"id"`
	Token   string `json:"token"`
	Expires string `json:"expires"`
}

func TestMembersRoutesNeedTheMembersRight(t *testing.T) {
	e := newRouteEnv(t)
	plain := testenv.User(t, e.app, "plain@example.com", "Plain")
	cats := e.admin("cats@example.com", admin.Categories)
	target := testenv.User(t, e.app, "target@example.com", "Target")
	for name, call := range map[string][3]string{
		"list":      {http.MethodGet, "/api/admin/members", ""},
		"create":    {http.MethodPost, "/api/admin/members", `{"name":"X","email":"x@example.com"}`},
		"patch":     {http.MethodPatch, "/api/admin/members/" + target.Id, `{"name":"Y"}`},
		"setupLink": {http.MethodPost, "/api/admin/members/" + target.Id + "/setup-link", ``},
	} {
		if rec := e.do(nil, call[0], call[1], call[2], nil); rec.Code != http.StatusUnauthorized {
			t.Errorf("%s anonymous: %d", name, rec.Code)
		}
		for who, user := range map[string]*core.Record{"plain": plain, "other area": cats} {
			if rec := e.do(user, call[0], call[1], call[2], nil); rec.Code != http.StatusForbidden {
				t.Errorf("%s as %s: %d", name, who, rec.Code)
			}
		}
	}
}

func TestListShowsEmailAndAreas(t *testing.T) {
	e := newRouteEnv(t)
	boss := e.admin("boss@example.com", admin.Members, admin.Transport)
	testenv.User(t, e.app, "plain@example.com", "Plain")
	var list []member
	if rec := e.do(boss, http.MethodGet, "/api/admin/members", "", &list); rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	byEmail := map[string]member{}
	for _, m := range list {
		byEmail[m.Email] = m
	}
	if got := byEmail["boss@example.com"].Areas; strings.Join(got, ",") != "members,transport" {
		t.Errorf("areas: %v", got)
	}
	if _, ok := byEmail["plain@example.com"]; !ok {
		t.Errorf("a member without rights is missing: %v", list)
	}
}

func TestCreateMemberIssuesALinkAndAudits(t *testing.T) {
	e := newRouteEnv(t)
	boss := e.admin("boss@example.com", admin.Members)
	var out issued
	rec := e.do(boss, http.MethodPost, "/api/admin/members", `{"name":"Neu","email":"neu@example.com"}`, &out)
	if rec.Code != 200 || out.Token == "" || out.ID == "" || out.Expires == "" {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	user, err := e.app.FindAuthRecordByEmail("users", "neu@example.com")
	if err != nil || user.GetBool("deactivated") || user.GetString("name") != "Neu" {
		t.Fatalf("user: %v %v", user, err)
	}
	rows, _ := e.app.FindAllRecords("admin_audit")
	if len(rows) != 1 || rows[0].GetString("admin") != boss.Id || rows[0].GetString("collection") != "users" {
		t.Fatalf("audit: %v", rows)
	}
	if strings.Contains(rows[0].GetString("summary"), out.Token) || strings.Contains(e.logs.String(), out.Token) {
		t.Fatal("the token leaked into the audit or the log")
	}
	for body, want := range map[string]int{
		`{"name":"Neu","email":"neu@example.com"}`:   http.StatusBadRequest, // duplicate
		`{"name":"","email":"a@example.com"}`:        http.StatusBadRequest,
		`{"name":"A","email":"not-an-email"}`:        http.StatusBadRequest,
		`{"name":"A","email":"a@example.com","x":1}`: http.StatusBadRequest,
	} {
		if rec := e.do(boss, http.MethodPost, "/api/admin/members", body, nil); rec.Code != want {
			t.Errorf("%s: %d", body, rec.Code)
		}
	}
}

func TestPatchMemberChangesOnlyThreeFields(t *testing.T) {
	e := newRouteEnv(t)
	boss := e.admin("boss@example.com", admin.Members)
	e.admin("second@example.com", admin.Members)
	target := testenv.User(t, e.app, "target@example.com", "Target")
	url := "/api/admin/members/" + target.Id

	if rec := e.do(boss, http.MethodPatch, url, `{"name":"Neu","email":"neu@example.com","deactivated":true}`, nil); rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	got, _ := e.app.FindRecordById("users", target.Id)
	if got.GetString("name") != "Neu" || got.Email() != "neu@example.com" || !got.GetBool("deactivated") {
		t.Fatalf("not applied: %v", got.PublicExport())
	}
	for _, body := range []string{`{"password":"hacked-password-1","passwordConfirm":"hacked-password-1"}`, `{"verified":true}`, `{"tokenKey":"x"}`, `{"name":"X","emailVisibility":true}`} {
		if rec := e.do(boss, http.MethodPatch, url, body, nil); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: %d", body, rec.Code)
		}
	}
	after, _ := e.app.FindRecordById("users", target.Id)
	if after.GetString("name") != "Neu" || after.GetString("tokenKey") != got.GetString("tokenKey") {
		t.Fatal("a refused patch changed the member")
	}
}

func TestPatchRefusesDeactivatingTheLastMembersHolder(t *testing.T) {
	e := newRouteEnv(t)
	boss := e.admin("boss@example.com", admin.Members)
	rec := e.do(boss, http.MethodPatch, "/api/admin/members/"+boss.Id, `{"deactivated":true}`, nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
}

func TestSetupLinkReplacesTheOpenOne(t *testing.T) {
	e := newRouteEnv(t)
	boss := e.admin("boss@example.com", admin.Members)
	target := testenv.User(t, e.app, "target@example.com", "Target")
	var first, second issued
	e.do(boss, http.MethodPost, "/api/admin/members/"+target.Id+"/setup-link", "", &first)
	e.do(boss, http.MethodPost, "/api/admin/members/"+target.Id+"/setup-link", "", &second)
	if first.Token == "" || second.Token == "" || first.Token == second.Token {
		t.Fatalf("tokens: %q %q", first.Token, second.Token)
	}
	open, _ := e.app.FindAllRecords("setup_links")
	if len(open) != 1 {
		t.Fatalf("want one open link, got %d", len(open))
	}
}

func TestSetupLinkIsRefusedForAnActiveAdmin(t *testing.T) {
	e := newRouteEnv(t)
	boss := e.admin("boss@example.com", admin.Members)
	other := e.admin("other@example.com", admin.Transport)
	url := "/api/admin/members/" + other.Id + "/setup-link"
	if rec := e.do(boss, http.MethodPost, url, "", nil); rec.Code != http.StatusBadRequest {
		t.Fatalf("an active admin must be refused: %d", rec.Code)
	}
	other.Set("deactivated", true)
	if err := e.app.Save(other); err != nil {
		t.Fatal(err)
	}
	if rec := e.do(boss, http.MethodPost, url, "", nil); rec.Code != 200 {
		t.Fatalf("a deactivated admin can get a link: %d %s", rec.Code, rec.Body)
	}
}
