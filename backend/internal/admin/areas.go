package admin

// The admin areas a user can hold. Members is the top right: its holder can grant any area.
const (
	Members     = "members"
	Categories  = "categories"
	Transport   = "transport"
	Corrections = "corrections"
)

// Areas lists every area, in the order the UI and the CLI show them.
var Areas = []string{Members, Categories, Transport, Corrections}

// Valid reports whether area is one of Areas.
func Valid(area string) bool {
	for _, a := range Areas {
		if a == area {
			return true
		}
	}
	return false
}
