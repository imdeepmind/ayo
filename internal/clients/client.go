package clients

import (
	"io"
	"os"
)

// Client abstracts the low-level storage primitives the upload feature depends
// on. Each method operates on a string "key": for the local filesystem backend
// a key is a path; future backends (S3, Azure Blob, GCP) will map a key onto a
// bucket/container + object. Callers resolve a concrete destination (including
// provider selection and path building) and hand it to the client, keeping
// clients a pure primitive layer with no domain knowledge.
//
// Serving as the seam for additional backends: implement these methods against
// a remote object store and swap the concrete backend in wiring.
type Client interface {
	// ReadFile returns the full contents of the file at key. It must return an
	// error if the file does not exist, since callers rely on that signal to
	// treat a missing blob/shard gracefully.
	ReadFile(key string) ([]byte, error)

	// WriteFile writes data to key, truncating any existing file, and returns
	// an error if the containing directory does not exist. Parents should be
	// created with MkdirAll first.
	WriteFile(key string, data []byte, mode os.FileMode) error

	// MkdirAll creates key and any missing parents with perm.
	MkdirAll(key string, perm os.FileMode) error

	// OpenWriter opens key for writing and returns a streaming writer so large
	// payloads (e.g. Reed-Solomon shards) never need to be fully buffered in
	// memory. Callers must Close it.
	OpenWriter(key string) (io.WriteCloser, error)

	// Stat reports the file described by key. Used to probe existence before an
	// operation that requires the bytes to already be present.
	Stat(key string) (os.FileInfo, error)

	// Remove deletes the file at key.
	Remove(key string) error

	// RemoveAll removes key and everything it contains (recursively).
	RemoveAll(key string) error
}
