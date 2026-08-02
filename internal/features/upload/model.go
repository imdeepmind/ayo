package upload

import "time"

// PickedFile is a file selected through the native file dialog. It carries the
// on-disk path the backend needs to process the file later, which the webview
// cannot provide for HTML file inputs on macOS.
type PickedFile struct {
	Name string
	Path string
	Size int64
}

// EnqueuedJob is the frontend-facing representation of a queued file. It is a
// slimmed-down view of a queue.Job: timestamps are omitted so the Wails model
// stays a flat, predictable shape.
type EnqueuedJob struct {
	ID         int64
	File       string
	CustomName string
	Size       int64
	Status     string
	Progress   int
	Tags       []string
}

// Upload is the persisted representation of a stored file, mirroring one row of
// the `uploads` table. It is created after a file has been fully processed
// (encrypted and chunked), so it only ever represents data the app actually
// holds. JobID links it back to the transient queue entry that produced it.
type Upload struct {
	ID         int64
	JobID      int64
	File       string
	CustomName string
	Size       int64
	Tags       []string
	StorageID  int
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// Chunk is the persisted representation of one Reed-Solomon shard, mirroring
// one row of the `chunks` table. ChunkID is the globally unique shard filename
// (a UUID); ShardIndex preserves the reconstruction order (data shards 0..D-1,
// then parity shards).
type Chunk struct {
	ID         int64
	FileID     int64
	ShardIndex int
	ChunkID    string
	StorageID  int
	CreatedAt  time.Time
}

// ChunkInput describes one shard to persist, before it has an ID.
type ChunkInput struct {
	ShardIndex int
	ChunkID    string
	StorageID  int
}
