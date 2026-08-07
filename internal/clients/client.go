package clients

import (
	"io"
)

// Client abstracts the storage backend primitives the upload feature reads and
// writes shards through. Each method operates on a string "key": for the local
// filesystem backend a key is a path; for S3 it is an object key in a bucket.
// Callers resolve a concrete destination (including provider selection and path
// building) and hand it to the client, keeping clients a pure primitive layer
// with no domain knowledge.
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
	// ReadFile returns the full contents of the object at key.
	ReadFile(key string) ([]byte, error)

	// OpenWriter opens key for writing and returns a streaming writer so large
	// payloads (e.g. Reed-Solomon shards) never need to be fully buffered in
	// memory. Callers must Close it; for S3 the writer uploads the whole object
	// on Close.
	OpenWriter(key string) (io.WriteCloser, error)

	// Remove deletes the object at key.
	Remove(key string) error
}
