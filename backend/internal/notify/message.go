package notify

import (
	"fmt"
	"slices"
	"strings"

	"github.com/ffneumarkt/intern/backend/internal/due"
)

// maxFilterIDs is the most items a link filters by; beyond it the link shows the whole list.
const maxFilterIDs = 50

// FiredItem is one item in a message, with its most urgent fired state.
type FiredItem struct {
	ID       string
	Category string // category name
	State    due.State
}

// Message is what a user receives. URL is relative to the origin.
type Message struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
}

// BuildMessage groups items by category, with the states in a fixed order.
func BuildMessage(items []FiredItem) Message {
	counts := map[string]*[3]int{}
	var ids []string
	for _, it := range items {
		c := counts[it.Category]
		if c == nil {
			c = &[3]int{}
			counts[it.Category] = c
		}
		switch it.State {
		case due.StateOverdue:
			c[0]++
		case due.StateDueToday:
			c[1]++
		default:
			c[2]++
		}
		ids = append(ids, it.ID)
	}

	names := make([]string, 0, len(counts))
	for name := range counts {
		names = append(names, name)
	}
	slices.Sort(names)

	labels := [3]string{"überfällig", "heute fällig", "bald fällig"}
	lines := make([]string, 0, len(names))
	for _, name := range names {
		var parts []string
		for i, n := range counts[name] {
			if n > 0 {
				parts = append(parts, fmt.Sprintf("%d %s", n, labels[i]))
			}
		}
		lines = append(lines, name+": "+strings.Join(parts, ", "))
	}

	url := "/material"
	if len(ids) > 0 && len(ids) <= maxFilterIDs {
		slices.Sort(ids)
		url += "?geraete=" + strings.Join(ids, ",")
	}
	return Message{Title: "FF Intern", Body: strings.Join(lines, "\n"), URL: url}
}
