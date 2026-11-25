package server

import (
	"net/http"
	"net/netip"
	"os"
	"path"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

// ShieldAdminAPI answers 404 to PocketBase's dashboard and admin API (the superuser login, settings,
// backups, logs, crons and the collection schema routes) unless the request is local. The app needs none
// of them; the superuser login is what guards the database, so it is not left to the proxy alone.
func ShieldAdminAPI(se *core.ServeEvent) {
	se.Router.BindFunc(func(e *core.RequestEvent) error {
		if blocked(e.Request.URL.Path) && !local(e.Request) {
			return e.NotFoundError("", nil)
		}
		return e.Next()
	})
}

// blocked reports whether the path belongs to the dashboard or the admin API.
func blocked(p string) bool {
	p = path.Clean("/" + p)
	if within(p, "/_") {
		return true
	}
	for _, prefix := range []string{"/api/settings", "/api/backups", "/api/logs", "/api/crons"} {
		if within(p, prefix) {
			return true
		}
	}
	if !within(p, "/api/collections") {
		return false
	}
	segments := strings.Split(strings.TrimPrefix(strings.TrimPrefix(p, "/api/collections"), "/"), "/")
	switch {
	case segments[0] == "": // the collection list and create
		return true
	case segments[0] == "_superusers", segments[0] == "import", segments[0] == "meta":
		return true
	case len(segments) == 1: // view, update and delete of a collection
		return true
	}
	return segments[1] == "truncate"
}

// within reports whether p is prefix or below it.
func within(p, prefix string) bool {
	return p == prefix || strings.HasPrefix(p, prefix+"/")
}

// local reports whether the request came straight from this machine: a loopback address without any
// header a proxy adds (the tunnel connects from loopback or the container network, so the address
// alone says nothing). ADMIN_API_ALLOW=true opens the admin API on purpose.
func local(r *http.Request) bool {
	if os.Getenv("ADMIN_API_ALLOW") == "true" {
		return true
	}
	for _, header := range []string{"X-Forwarded-For", "Forwarded", "Cf-Connecting-Ip"} {
		if r.Header.Get(header) != "" {
			return false
		}
	}
	addr, err := netip.ParseAddrPort(r.RemoteAddr)
	if err != nil {
		return false
	}
	return addr.Addr().IsLoopback()
}
