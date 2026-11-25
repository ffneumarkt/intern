package main

import (
	"bytes"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

// runOn executes `intern admin <args>` against app and returns what it printed.
func runOn(t *testing.T, app core.App, args ...string) (string, error) {
	t.Helper()
	cmd := adminCommand(app)
	var out bytes.Buffer
	cmd.SetOut(&out)
	cmd.SetErr(&out)
	cmd.SetArgs(args)
	err := cmd.Execute()
	return out.String(), err
}

func TestAdminCommand(t *testing.T) {
	app := testenv.New(t)
	testenv.User(t, app, "a@example.com", "A")

	out, err := runOn(t, app, "grant", "a@example.com", "members", "transport")
	if err != nil || !strings.Contains(out, "a@example.com") {
		t.Fatalf("grant: %q %v", out, err)
	}
	out, err = runOn(t, app, "list")
	if err != nil || strings.TrimSpace(out) != "a@example.com: members, transport" {
		t.Fatalf("list: %q %v", out, err)
	}
	if _, err := runOn(t, app, "grant", "nobody@example.com", "members"); err == nil {
		t.Fatal("an unknown user must fail")
	}
	if _, err := runOn(t, app, "revoke", "a@example.com", "members"); err == nil {
		t.Fatal("revoking the last members holder must fail")
	}
	if _, err := runOn(t, app, "revoke", "a@example.com", "transport"); err != nil {
		t.Fatal(err)
	}
}
