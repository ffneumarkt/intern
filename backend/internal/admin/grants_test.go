package admin_test

import (
	"reflect"
	"strings"
	"testing"

	"github.com/ffneumarkt/intern/backend/internal/admin"
	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

func TestGrantCreatesRowsAndRepeatsAreNoOps(t *testing.T) {
	app := testenv.New(t)
	testenv.User(t, app, "a@example.com", "A")
	if err := admin.Grant(app, "a@example.com", admin.Members, admin.Transport); err != nil {
		t.Fatal(err)
	}
	if err := admin.Grant(app, "a@example.com", admin.Members); err != nil {
		t.Fatalf("a repeated grant must not fail: %v", err)
	}
	holders, err := admin.List(app)
	if err != nil {
		t.Fatal(err)
	}
	want := []admin.Holder{{Email: "a@example.com", Areas: []string{admin.Members, admin.Transport}}}
	if !reflect.DeepEqual(holders, want) {
		t.Fatalf("got %+v, want %+v", holders, want)
	}
}

func TestGrantRefusesBadInputAndCreatesNothing(t *testing.T) {
	app := testenv.New(t)
	testenv.User(t, app, "a@example.com", "A")
	for name, call := range map[string]func() error{
		"unknown user": func() error { return admin.Grant(app, "nobody@example.com", admin.Members) },
		"unknown area": func() error { return admin.Grant(app, "a@example.com", admin.Members, "nope") },
		"no areas":     func() error { return admin.Grant(app, "a@example.com") },
	} {
		if err := call(); err == nil {
			t.Errorf("%s: want an error", name)
		}
	}
	if holders, _ := admin.List(app); len(holders) != 0 {
		t.Fatalf("a refused grant created rows: %+v", holders)
	}
}

func TestRevoke(t *testing.T) {
	app := testenv.New(t)
	testenv.Admin(t, app, testenv.User(t, app, "a@example.com", "A"), admin.Members, admin.Transport)
	testenv.Admin(t, app, testenv.User(t, app, "b@example.com", "B"), admin.Members)

	if err := admin.Revoke(app, "a@example.com", admin.Transport, admin.Corrections); err != nil {
		t.Fatalf("an area that is not held is skipped: %v", err)
	}
	if err := admin.Revoke(app, "a@example.com", admin.Members); err != nil {
		t.Fatalf("with a second holder: %v", err)
	}
	err := admin.Revoke(app, "b@example.com", admin.Members)
	if err == nil || !strings.Contains(err.Error(), "last holder") {
		t.Fatalf("the last members holder must stay, got %v", err)
	}
}

func TestListIsSortedByEmailAndAreaOrder(t *testing.T) {
	app := testenv.New(t)
	testenv.Admin(t, app, testenv.User(t, app, "z@example.com", "Z"), admin.Corrections, admin.Members)
	testenv.Admin(t, app, testenv.User(t, app, "a@example.com", "A"), admin.Transport)
	holders, err := admin.List(app)
	if err != nil {
		t.Fatal(err)
	}
	want := []admin.Holder{
		{Email: "a@example.com", Areas: []string{admin.Transport}},
		{Email: "z@example.com", Areas: []string{admin.Members, admin.Corrections}},
	}
	if !reflect.DeepEqual(holders, want) {
		t.Fatalf("got %+v, want %+v", holders, want)
	}
}
