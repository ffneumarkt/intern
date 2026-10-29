package server

import (
	"io/fs"
	"strings"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// RegisterFrontend serves the built frontend at / with index.html as fallback for client-side
// routes. PocketBase's own paths (/api/, /_/) are left to their handlers.
func RegisterFrontend(se *core.ServeEvent, fsys fs.FS) {
	static := apis.Static(fsys, true)
	se.Router.GET("/{path...}", func(e *core.RequestEvent) error {
		p := e.Request.URL.Path
		if strings.HasPrefix(p, "/api/") || strings.HasPrefix(p, "/_/") {
			return e.NotFoundError("", nil)
		}
		return static(e)
	})
}
