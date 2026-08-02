// Package queue provides a persistent, SQLite-backed job queue shared across
// features. It belongs to the platform tier: each uploaded file becomes one Job
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

// Job types are the operation each queue entry represents. They are stored as
// lowercase strings and enforced by a CHECK constraint on the type column, so
// the queue can hold a mix of upload/download/delete work.
const (
	TypeUpload   = "upload"
	TypeDownload = "download"
	TypeDelete   = "delete"
)

// Job is the persisted representation of one queue entry, mirroring one row of
// the `queue` table. It is created when a file is queued for processing and is
// updated in place as the file progresses.
type Job struct {
	ID int64
	// Type is the operation this job represents (upload, download or delete).
	Type string
	// FileID references the stored upload this job operates on (uploads.id).
	// It is set for download/delete jobs and 0 for uploads, which carry their
	// own source File instead.
	FileID int64
	// File is the original filename as it exists on disk (used to read the
	// file during processing).
	File string
	// CustomName is the user-facing display name. It may differ from File
	// when the user renames the file during upload; when empty it falls back
	// to File.
	CustomName string
	Path       string
	Size       int64
	Status     string
	Progress   int
	// Tags are user-assigned labels for the file, stored as a JSON array.
	Tags []string
	// CreatedAt/UpdatedAt are set by the database. CreatedAt is assigned on
	// insert; UpdatedAt is bumped whenever the row changes.
	CreatedAt time.Time
	UpdatedAt time.Time
}
