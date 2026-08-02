// Package queue provides a persistent, SQLite-backed job queue shared across
// features. It belongs to the shared tier: each uploaded file becomes one Job
// that a worker processes later, and the queue is the single source of truth
// for what has been submitted, is running, or has finished.
package queue

import "time"

// Job statuses are stored as lowercase strings. They are the canonical set the
// queue understands; processing logic maps them to UI states.
const (
	StatusPending    = "pending"
	StatusProcessing = "processing"
	StatusCompleted  = "completed"
	StatusFailed     = "failed"
)

// Job is the persisted representation of one queue entry, mirroring one row of
// the `queue` table. It is created when a file is queued for processing and is
// updated in place as the file progresses.
type Job struct {
	ID       int64
	File     string
	Path     string
	Size     int64
	Status   string
	Progress int
	// CreatedAt/UpdatedAt are set by the database. CreatedAt is assigned on
	// insert; UpdatedAt is bumped whenever the row changes.
	CreatedAt time.Time
	UpdatedAt time.Time
}
