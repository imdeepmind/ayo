package storage

import (
	"io"
)

// Client abstracts the storage backend primitives the upload feature reads and
// writes shards through. Each method operates on a string "key": for the local
// filesystem backend a key is a path; for S3 it is an object key in a bucket.
//
// Provider selection, path/object-key building and the per-provider dispatch
// all live in this package (OpenShardWriter and ResolveShard), so the upload
// layer never sees a provider type: adding a new backend only adds a case in
// this package's dispatch functions plus a Client implementation.
//
// Only operations that are genuinely portable across backends live here.
// Filesystem-specific operations (MkdirAll, Stat, RemoveAll and the one-shot
// WriteFile) are inherently local and stay on the concrete LocalFilesystem
// client, which also creates parent directories internally so callers never
// need to mkdir before a write.
//
// ReadFile must return an error if the object does not exist, since callers
// rely on that signal to treat a missing blob/shard gracefully (e.g. a shard to
// recover from parity).
type Client interface {
	// ReadFile returns the full contents of the object at key. Suitable for
	// small objects (metadata, small shards). For large objects, prefer
	// OpenReader for streaming.
	ReadFile(key string) ([]byte, error)

	// OpenReader opens key for streaming read and returns an io.ReadCloser.
	// Callers must Close it to release resources. Suitable for large objects
	// where reading the full contents into memory is inefficient.
	OpenReader(key string) (io.ReadCloser, error)

	// OpenWriter opens key for writing and returns a streaming writer so large
	// payloads (e.g. Reed-Solomon shards) never need to be fully buffered in
	// memory. Callers must Close it; for S3 the writer uploads the whole object
	// on Close.
	OpenWriter(key string) (io.WriteCloser, error)

	// Remove deletes the object at key.
	Remove(key string) error
}
