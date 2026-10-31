package push

import (
	"errors"
	"net/http"
	"strings"

	"github.com/charmbracelet/log"
	ozzo "github.com/go-ozzo/ozzo-validation/v4"
	pbozzo "github.com/pocketbase/ozzo-validation/v4"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/notify"
)

type routes struct {
	keys   Keys
	sender notify.Sender
	logger *log.Logger
}

// RegisterRoutes adds the push routes. Without keys, sender is nil, the key route answers 404 and
// test pushes are refused.
func RegisterRoutes(se *core.ServeEvent, keys Keys, sender notify.Sender, logger *log.Logger) {
	r := &routes{keys: keys, sender: sender, logger: logger}
	group := se.Router.Group("/api/push")
	group.GET("/key", r.key)
	group.POST("/subscribe", r.subscribe).Bind(apis.RequireAuth("users"))
	group.POST("/test", r.test).Bind(apis.RequireAuth("users"))
}

func (r *routes) key(e *core.RequestEvent) error {
	if r.sender == nil {
		return e.NotFoundError("Push is not set up.", nil)
	}
	return e.JSON(http.StatusOK, map[string]string{"publicKey": r.keys.Public})
}

func (r *routes) subscribe(e *core.RequestEvent) error {
	var body struct {
		Endpoint    string `json:"endpoint"`
		P256dh      string `json:"p256dh"`
		Auth        string `json:"auth"`
		DeviceLabel string `json:"deviceLabel"`
	}
	if err := e.BindBody(&body); err != nil {
		return e.BadRequestError("Invalid request.", err)
	}
	if body.Endpoint == "" || body.P256dh == "" || body.Auth == "" {
		return e.BadRequestError("endpoint, p256dh and auth are required.", nil)
	}

	// An endpoint belongs to one browser profile, so a new owner takes the row over.
	record, err := e.App.FindFirstRecordByData("push_subscriptions", "endpoint", body.Endpoint)
	if err != nil {
		collection, err := e.App.FindCollectionByNameOrId("push_subscriptions")
		if err != nil {
			return err
		}
		record = core.NewRecord(collection)
	}
	record.Set("user", e.Auth.Id)
	record.Set("endpoint", body.Endpoint)
	record.Set("p256dh", body.P256dh)
	record.Set("auth", body.Auth)
	record.Set("device_label", strings.TrimSpace(body.DeviceLabel))
	if err := e.App.Save(record); err != nil {
		// The hooks return go-ozzo errors, which PocketBase does not map to a 400 itself.
		var hook ozzo.Errors
		var own pbozzo.Errors
		if errors.As(err, &hook) || errors.As(err, &own) {
			r.logger.Warn("push subscription refused", "user", e.Auth.Id, "err", err)
			return e.BadRequestError("Invalid subscription.", nil)
		}
		return err
	}
	return e.NoContent(http.StatusNoContent)
}

func (r *routes) test(e *core.RequestEvent) error {
	if r.sender == nil {
		return e.NotFoundError("Push is not set up.", nil)
	}
	delivered, err := r.sender.Send(e.Auth.Id, notify.Message{
		Title: "FF Intern",
		Body:  "Benachrichtigungen funktionieren.",
		URL:   "/",
	})
	if err != nil {
		return err
	}
	return e.JSON(http.StatusOK, map[string]int{"delivered": delivered})
}
