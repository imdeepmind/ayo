// Package ratelimit provides a small in-memory lockout limiter. It tracks
// consecutive failed attempts per key and blocks the key for a fixed window
// once a threshold is reached. State is process-local and lost on restart,
// which is acceptable for a desktop app.
//
// All state is guarded by an internal mutex; critical sections are kept short
// (map lookups only), so callers never hold the lock across expensive work such
// as Argon2 derivation.
package ratelimit

import (
	"sync"
	"time"
)

// entry is the per-key attempt state.
type entry struct {
	count       int
	lockedUntil time.Time
}

// Limiter tracks failed attempts per key and enforces a lockout window. Create
// one limiter per protected action (e.g. login, register, reset), each with its
// own quota.
type Limiter struct {
	mu          sync.Mutex
	maxAttempts int
	lockout     time.Duration
	entries     map[string]*entry
}

// New returns a Limiter that locks a key for lockout once maxAttempts
// consecutive failures are recorded.
func New(maxAttempts int, lockout time.Duration) *Limiter {
	return &Limiter{
		maxAttempts: maxAttempts,
		lockout:     lockout,
		entries:     make(map[string]*entry),
	}
}

// Check reports whether the key may proceed. When blocked, retryAfter is the
// remaining lockout duration. An expired lockout clears the key's state, so the
// counter starts fresh after the window passes.
func (l *Limiter) Check(key string) (allowed bool, retryAfter time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	e, ok := l.entries[key]
	if !ok {
		return true, 0
	}
	now := time.Now()
	if now.Before(e.lockedUntil) {
		return false, e.lockedUntil.Sub(now).Round(time.Second)
	}
	// A lockout that has expired clears the key so the next attempt starts a
	// fresh window. Entries that have never tripped a lockout (lockedUntil is
	// zero) are left untouched so the failure counter keeps accumulating.
	if !e.lockedUntil.IsZero() {
		delete(l.entries, key)
	}
	return true, 0
}

// RecordFailure counts one failed attempt for the key and locks it once the
// threshold is reached. The lockout window is measured from the attempt that
// trips it.
func (l *Limiter) RecordFailure(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	e, ok := l.entries[key]
	if !ok {
		e = &entry{}
		l.entries[key] = e
	}
	now := time.Now()
	// A prior lockout may have expired between attempts; start a fresh window.
	// (Check normally removes expired entries first, but this guards the
	// RecordFailure-only path.)
	if !e.lockedUntil.IsZero() && !now.Before(e.lockedUntil) {
		e.count = 0
		e.lockedUntil = time.Time{}
	}
	e.count++
	if e.count >= l.maxAttempts {
		e.lockedUntil = now.Add(l.lockout)
	}
}

// Reset clears all tracked state for the key. Call it on a successful attempt
// so prior failures are forgotten.
func (l *Limiter) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.entries, key)
}
