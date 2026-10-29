package logging

import (
	"testing"

	"github.com/charmbracelet/log"
)

func TestParseLevel(t *testing.T) {
	cases := map[string]log.Level{
		"":         log.InfoLevel,
		"debug":    log.DebugLevel,
		"WARN":     log.WarnLevel,
		"error":    log.ErrorLevel,
		"nonsense": log.InfoLevel,
	}
	for in, want := range cases {
		if got := ParseLevel(in); got != want {
			t.Errorf("ParseLevel(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestNewUsesLevel(t *testing.T) {
	if got := New("debug").GetLevel(); got != log.DebugLevel {
		t.Errorf("level = %v, want debug", got)
	}
}
