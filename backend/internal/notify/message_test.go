package notify

import (
	"fmt"
	"testing"

	"github.com/ffneumarkt/intern/backend/internal/due"
)

func TestBuildMessage(t *testing.T) {
	m := BuildMessage([]FiredItem{
		{ID: "c", Category: "Masken", State: due.StateDueToday},
		{ID: "b", Category: "Masken", State: due.StateOverdue},
		{ID: "a", Category: "Masken", State: due.StateOverdue},
		{ID: "d", Category: "Leitern", State: due.StateDueSoon},
	})
	if m.Title != "FF Intern" {
		t.Errorf("title %q", m.Title)
	}
	if want := "Leitern: 1 bald fällig\nMasken: 2 überfällig, 1 heute fällig"; m.Body != want {
		t.Errorf("body %q, want %q", m.Body, want)
	}
	if want := "/material?geraete=a,b,c,d"; m.URL != want {
		t.Errorf("url %q, want %q", m.URL, want)
	}
}

func TestBuildMessageOKCountsAsSoon(t *testing.T) {
	m := BuildMessage([]FiredItem{{ID: "a", Category: "X", State: due.StateOK}})
	if want := "X: 1 bald fällig"; m.Body != want {
		t.Errorf("body %q, want %q", m.Body, want)
	}
}

func TestBuildMessageURLLimit(t *testing.T) {
	items := func(n int) []FiredItem {
		var out []FiredItem
		for i := range n {
			out = append(out, FiredItem{ID: fmt.Sprintf("i%03d", i), Category: "X", State: due.StateOverdue})
		}
		return out
	}
	if got := BuildMessage(items(50)).URL; len(got) <= len("/material") {
		t.Errorf("50 items lost the filter: %q", got)
	}
	if got := BuildMessage(items(51)).URL; got != "/material" {
		t.Errorf("51 items: %q", got)
	}
}
