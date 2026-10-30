package passkey

import (
	"crypto/rand"
	"encoding/base64"
	"sync"
	"time"

	"github.com/go-webauthn/webauthn/webauthn"
)

const (
	sessionLifetime = 5 * time.Minute
	// login/begin is public, so the store must not grow without bound.
	maxPending = 1000
)

// purpose keeps the steps apart: a confirm session must not finish a registration, or anyone with
// a logged-in session could skip the confirmation.
type purpose int

const (
	purposeLogin purpose = iota + 1
	purposeConfirm
	purposeGrant
	purposeRegister
)

// pending is a ceremony between begin and finish, or a grant from a confirmation. UserID is empty
// for a login.
type pending struct {
	Purpose purpose
	Data    webauthn.SessionData
	UserID  string
}

type entry struct {
	pending
	expires time.Time
}

// sessions keeps ceremonies in memory; after a restart the user simply starts again.
type sessions struct {
	mu      sync.Mutex
	now     func() time.Time
	entries map[string]entry
}

func newSessions(now func() time.Time) *sessions {
	return &sessions{now: now, entries: map[string]entry{}}
}

func (s *sessions) put(p pending) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	id := base64.RawURLEncoding.EncodeToString(raw)

	s.mu.Lock()
	defer s.mu.Unlock()
	s.dropExpired()
	if len(s.entries) >= maxPending {
		s.dropOldest()
	}
	s.entries[id] = entry{pending: p, expires: s.now().Add(sessionLifetime)}
	return id, nil
}

// take removes the session, so a finish request cannot be replayed.
func (s *sessions) take(id string, wanted purpose) (pending, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.entries[id]
	delete(s.entries, id)
	if !ok || e.Purpose != wanted || !s.now().Before(e.expires) {
		return pending{}, false
	}
	return e.pending, true
}

func (s *sessions) dropExpired() {
	for id, e := range s.entries {
		if !s.now().Before(e.expires) {
			delete(s.entries, id)
		}
	}
}

func (s *sessions) dropOldest() {
	var oldest string
	var oldestExpiry time.Time
	for id, e := range s.entries {
		if oldest == "" || e.expires.Before(oldestExpiry) {
			oldest, oldestExpiry = id, e.expires
		}
	}
	delete(s.entries, oldest)
}
