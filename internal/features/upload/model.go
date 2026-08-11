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
// stays a flat, predictable shape. Type lets the UI distinguish upload,
// download and (future) delete jobs.
type EnqueuedJob struct {
	ID         int64
	Type       string
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
// holds. JobID links it back to the transient queue entry that produced it. The
// Erasure* fields carry the reconstruction metadata that a manifest used to
// hold: the exact encrypted size to trim Reed-Solomon padding and the shard
// layout used to rebuild the file during download.
//
// FormatVersion identifies the encryption format: version 1 used single-pass
// AES-GCM (deprecated, memory-intensive), version 2 uses chunked streaming
// encryption (current).
type Upload struct {
	ID            int64
	JobID         int64
	File          string
	CustomName    string
	Size          int64
	Tags          []string
	FormatVersion int

	EncryptedSize int64
	DataShards    int
	ParityShards  int
	ShardSize     int
	BlockCount    int

	CreatedAt time.Time
	UpdatedAt time.Time
}

// Chunk is the persisted representation of one Reed-Solomon shard, mirroring
// one row of the `chunks` table. ChunkID is the globally unique shard filename
// (a UUID); ShardIndex preserves the reconstruction order (data shards 0..D-1,
// then parity shards). StorageID identifies the provider the shard was uploaded
// to (e.g. "local_ab12cd34").
type Chunk struct {
	ID         int64
	FileID     int64
	ShardIndex int
	ChunkID    string
	StorageID  string
	CreatedAt  time.Time
}

// ChunkInput describes one shard to persist, before it has an ID. StorageID is
// the provider ID the shard was assigned to during upload.
type ChunkInput struct {
	ShardIndex int
	ChunkID    string
	StorageID  string
}

// StoredFile is the frontend-facing representation of one row of the `uploads`
// table, used by the Home/drive screen. Timestamps are strings so the Wails
// model stays a flat, predictable shape.
type StoredFile struct {
	ID        int64
	Name      string
	Size      int64
	Tags      []string
	CreatedAt string
}

// StoredFilePage is one page of the drive listing returned by GetStoredFiles.
// Total is the count of all matching rows (unbounded by page size) so the
// frontend can render pagination controls.
type StoredFilePage struct {
	Files    []StoredFile
	Total    int64
	Page     int
	PageSize int
}
