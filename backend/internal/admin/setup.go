package admin

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"
)

// noReferrer keeps the address of the setup page, and so the link, from leaving with any request.
func noReferrer(e *core.RequestEvent) error {
	e.Response.Header().Set("Referrer-Policy", "no-referrer")
	return e.Next()
}

func (a *api) checkLink(e *core.RequestEvent) error    { return e.NoContent(http.StatusNotImplemented) }
func (a *api) completeLink(e *core.RequestEvent) error { return e.NoContent(http.StatusNotImplemented) }
