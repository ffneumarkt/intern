package push

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/charmbracelet/log"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/notify"
)

// ttlSeconds is how long a push service keeps a message for an offline device.
const ttlSeconds = 86400

// Keys are the VAPID key pair and the contact (mailto: address or https URL) of the sender.
type Keys struct{ Public, Private, Subject string }

// KeysFromEnv reads VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT. ok is false unless all are set.
func KeysFromEnv() (keys Keys, ok bool) {
	keys = Keys{
		Public:  os.Getenv("VAPID_PUBLIC_KEY"),
		Private: os.Getenv("VAPID_PRIVATE_KEY"),
		Subject: os.Getenv("VAPID_SUBJECT"),
	}
	return keys, keys.Public != "" && keys.Private != "" && keys.Subject != ""
}

// Sender sends Web Push messages to the subscriptions of a user.
type Sender struct {
	App    core.App
	Keys   Keys
	Client *http.Client // nil means http.DefaultClient
	Logger *log.Logger
}

var _ notify.Sender = (*Sender)(nil)

// Send returns the number of devices that accepted the message. Subscriptions answered with 404 or
// 410 are deleted; other failures are logged and keep the subscription.
func (s *Sender) Send(userID string, message notify.Message) (int, error) {
	subs, err := s.App.FindAllRecords("push_subscriptions", dbx.HashExp{"user": userID})
	if err != nil {
		return 0, fmt.Errorf("load subscriptions: %w", err)
	}
	payload, err := json.Marshal(message)
	if err != nil {
		return 0, fmt.Errorf("encode message: %w", err)
	}
	// webpush-go prefixes anything that is not an https: URL with "mailto:".
	subject := strings.TrimPrefix(s.Keys.Subject, "mailto:")

	delivered := 0
	for _, sub := range subs {
		resp, err := webpush.SendNotification(payload, &webpush.Subscription{
			Endpoint: sub.GetString("endpoint"),
			Keys:     webpush.Keys{P256dh: sub.GetString("p256dh"), Auth: sub.GetString("auth")},
		}, &webpush.Options{
			HTTPClient:      s.Client,
			VAPIDPublicKey:  s.Keys.Public,
			VAPIDPrivateKey: s.Keys.Private,
			Subscriber:      subject,
			TTL:             ttlSeconds,
		})
		if err != nil {
			s.Logger.Error("web push failed", "user", userID, "subscription", sub.Id, "err", err)
			continue
		}
		_ = resp.Body.Close()

		switch {
		case resp.StatusCode >= 200 && resp.StatusCode < 300:
			delivered++
		case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone:
			s.Logger.Info("removing expired push subscription", "user", userID, "subscription", sub.Id, "status", resp.StatusCode)
			if err := s.App.Delete(sub); err != nil {
				s.Logger.Error("delete push subscription", "subscription", sub.Id, "err", err)
			}
		default:
			s.Logger.Warn("push service rejected message", "user", userID, "subscription", sub.Id, "status", resp.StatusCode)
		}
	}
	return delivered, nil
}
