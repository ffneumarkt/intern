package passkey

import (
	"sync"
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/webauthn"
)

type clock struct{ now time.Time }

func (c *clock) get() time.Time { return c.now }

func newTestSessions() (*sessions, *clock) {
	c := &clock{now: time.Date(2026, 10, 30, 12, 0, 0, 0, time.UTC)}
	return newSessions(c.get), c
}

func TestTakeReturnsWhatWasPut(t *testing.T) {
	s, _ := newTestSessions()
	id, err := s.put(pending{UserID: "u1", Data: webauthn.SessionData{Challenge: "c"}})
	if err != nil {
		t.Fatal(err)
	}
	p, ok := s.take(id)
	if !ok || p.UserID != "u1" || p.Data.Challenge != "c" {
		t.Errorf("got %+v, %v", p, ok)
	}
}

func TestTakeIsSingleUse(t *testing.T) {
	s, _ := newTestSessions()
	id, _ := s.put(pending{})
	s.take(id)
	if _, ok := s.take(id); ok {
		t.Error("second take succeeded")
	}
}

func TestUnknownIDIsNotFound(t *testing.T) {
	s, _ := newTestSessions()
	if _, ok := s.take("nope"); ok {
		t.Error("unknown id found")
	}
}

func TestIDsDiffer(t *testing.T) {
	s, _ := newTestSessions()
	a, _ := s.put(pending{})
	b, _ := s.put(pending{})
	if a == b {
		t.Error("same id twice")
	}
}

func TestExpiresAfterFiveMinutes(t *testing.T) {
	s, c := newTestSessions()
	early, _ := s.put(pending{})
	late, _ := s.put(pending{})

	c.now = c.now.Add(5*time.Minute - time.Second)
	if _, ok := s.take(early); !ok {
		t.Error("expired too early")
	}
	c.now = c.now.Add(2 * time.Second)
	if _, ok := s.take(late); ok {
		t.Error("still valid after five minutes")
	}
}

func TestPutDropsExpired(t *testing.T) {
	s, c := newTestSessions()
	s.put(pending{})
	c.now = c.now.Add(6 * time.Minute)
	s.put(pending{})
	if len(s.entries) != 1 {
		t.Errorf("%d entries", len(s.entries))
	}
}

func TestCapDropsOldest(t *testing.T) {
	s, c := newTestSessions()
	first, _ := s.put(pending{})
	for range maxPending {
		c.now = c.now.Add(time.Millisecond)
		s.put(pending{})
	}
	if len(s.entries) != maxPending {
		t.Errorf("%d entries", len(s.entries))
	}
	if _, ok := s.take(first); ok {
		t.Error("oldest entry survived")
	}
}

func TestConcurrentUse(t *testing.T) {
	s, _ := newTestSessions()
	var wg sync.WaitGroup
	for range 50 {
		wg.Go(func() {
			id, _ := s.put(pending{})
			s.take(id)
		})
	}
	wg.Wait()
}
