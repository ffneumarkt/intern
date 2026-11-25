package main

import (
	"bytes"
	"strings"
	"testing"

	"github.com/ffneumarkt/intern/backend/internal/testenv"
)

func TestBootstrapCommand(t *testing.T) {
	app := testenv.New(t)
	cmd := bootstrapCommand(app)
	var out bytes.Buffer
	cmd.SetOut(&out)
	cmd.SetErr(&out)
	cmd.SetArgs([]string{"--admin-email", "chef@example.com", "--admin-name", "Chef"})
	if err := cmd.Execute(); err != nil {
		t.Fatalf("%v: %s", err, out.String())
	}
	text := out.String()
	for _, want := range []string{"2 categories", "3 check types", "2 locations", "chef@example.com", "password:"} {
		if !strings.Contains(text, want) {
			t.Errorf("output lacks %q:\n%s", want, text)
		}
	}
	if n, _ := app.CountRecords("categories"); n != 2 {
		t.Fatalf("categories: %d", n)
	}
}

func TestBootstrapWithoutAdminOnlyAppliesTheDefaults(t *testing.T) {
	app := testenv.New(t)
	cmd := bootstrapCommand(app)
	var out bytes.Buffer
	cmd.SetOut(&out)
	cmd.SetErr(&out)
	cmd.SetArgs(nil)
	if err := cmd.Execute(); err != nil {
		t.Fatal(err)
	}
	if n, _ := app.CountRecords("users"); n != 0 {
		t.Fatalf("no user without --admin-email: %d", n)
	}
}

func TestBootstrapRefusesAnAdminNameWithoutEmail(t *testing.T) {
	app := testenv.New(t)
	cmd := bootstrapCommand(app)
	cmd.SetOut(&bytes.Buffer{})
	cmd.SetErr(&bytes.Buffer{})
	cmd.SetArgs([]string{"--admin-name", "Chef"})
	if err := cmd.Execute(); err == nil {
		t.Fatal("expected an error")
	}
}
