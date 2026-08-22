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
// fileNonce, encryptedFileKey and keyNonce carry the envelope-encryption
// metadata, stored the same way the master key is (nonce + wrapped key as
// raw byte columns, see the `users` table): encryptedFileKey is the per-file
// Data Encryption Key sealed by the master key (ciphertext ‖ tag, 48 bytes),
// keyNonce is the 12-byte nonce that sealed it, and fileNonce is the 12-byte
// base nonce the file payload chunks were encrypted with. The encrypted
// payload itself lives on the storage providers; nothing here is plaintext.
//
// These three fields are unexported because they are key material, internal to
// package upload (only its repository populates them and its processor reads
// them). Wails serializes only exported fields, so the wrapped DEK and nonces
// can never reach the frontend. Keep them unexported; display queries must not
// select the backing columns.
type Upload struct {
	ID         int64
	JobID      int64
	File       string
	CustomName string
	Size       int64
	Tags       []string

	EncryptedSize int64
	DataShards    int
	ParityShards  int
	ShardSize     int
	BlockCount    int

	fileNonce        []byte
	encryptedFileKey []byte
	keyNonce         []byte

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
