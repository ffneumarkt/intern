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
	id, err := s.put(pending{Purpose: purposeLogin, UserID: "u1", Data: webauthn.SessionData{Challenge: "c"}})
	if err != nil {
		t.Fatal(err)
	}
	p, ok := s.take(id, purposeLogin)
	if !ok || p.UserID != "u1" || p.Data.Challenge != "c" {
		t.Errorf("got %+v, %v", p, ok)
	}
}

func TestTakeIsSingleUse(t *testing.T) {
	s, _ := newTestSessions()
	id, _ := s.put(pending{Purpose: purposeLogin})
	s.take(id, purposeLogin)
	if _, ok := s.take(id, purposeLogin); ok {
		t.Error("second take succeeded")
	}
}

func TestUnknownIDIsNotFound(t *testing.T) {
	s, _ := newTestSessions()
	if _, ok := s.take("nope", purposeLogin); ok {
		t.Error("unknown id found")
	}
}

func TestWrongPurposeIsRefusedAndUsesItUp(t *testing.T) {
	s, _ := newTestSessions()
	id, _ := s.put(pending{Purpose: purposeConfirm})
	if _, ok := s.take(id, purposeRegister); ok {
		t.Error("taken for another purpose")
	}
	if _, ok := s.take(id, purposeConfirm); ok {
		t.Error("still there after a wrong attempt")
	}
}

func TestIDsDiffer(t *testing.T) {
	s, _ := newTestSessions()
	a, _ := s.put(pending{Purpose: purposeLogin})
	b, _ := s.put(pending{Purpose: purposeLogin})
	if a == b {
		t.Error("same id twice")
	}
}

func TestExpiresAfterFiveMinutes(t *testing.T) {
	s, c := newTestSessions()
	early, _ := s.put(pending{Purpose: purposeLogin})
	late, _ := s.put(pending{Purpose: purposeLogin})

	c.now = c.now.Add(5*time.Minute - time.Second)
	if _, ok := s.take(early, purposeLogin); !ok {
		t.Error("expired too early")
	}
	c.now = c.now.Add(2 * time.Second)
	if _, ok := s.take(late, purposeLogin); ok {
		t.Error("still valid after five minutes")
	}
}

func TestPutDropsExpired(t *testing.T) {
	s, c := newTestSessions()
	s.put(pending{Purpose: purposeLogin})
	c.now = c.now.Add(6 * time.Minute)
	s.put(pending{Purpose: purposeLogin})
	if len(s.entries) != 1 {
		t.Errorf("%d entries", len(s.entries))
	}
}

func TestCapDropsOldest(t *testing.T) {
	s, c := newTestSessions()
	first, _ := s.put(pending{Purpose: purposeLogin})
	for range maxPending {
		c.now = c.now.Add(time.Millisecond)
		s.put(pending{Purpose: purposeLogin})
	}
	if len(s.entries) != maxPending {
		t.Errorf("%d entries", len(s.entries))
	}
	if _, ok := s.take(first, purposeLogin); ok {
		t.Error("oldest entry survived")
	}
}

func TestConcurrentUse(t *testing.T) {
	s, _ := newTestSessions()
	var wg sync.WaitGroup
	for range 50 {
		wg.Go(func() {
			id, _ := s.put(pending{Purpose: purposeLogin})
			s.take(id, purposeLogin)
		})
	}
	wg.Wait()
}
