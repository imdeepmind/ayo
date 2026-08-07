package clients

import (
	"io"
	"os"
)

// LocalFilesystem is the default Client backed by the local OS filesystem. Every
// key is interpreted as a filesystem path relative to or absolute on the host.
// Permissions mirror how the upload feature manages runtime data: directories
// are created with the owner-only mode 0o700 and regular files with 0o600.
//
// It is the only Client implementation for now; the interface exists so remote
// backends (S3, Azure Blob, GCP) can be added later without touching callers.
type LocalFilesystem struct{}

// NewLocalFilesystem returns a ready-to-use local filesystem client.
func NewLocalFilesystem() *LocalFilesystem {
	return &LocalFilesystem{}
}

// ReadFile reads the whole file at key.
func (fs *LocalFilesystem) ReadFile(key string) ([]byte, error) {
	return os.ReadFile(key)
}

// WriteFile writes data to key with the given mode, truncating any existing
// file. The parent directory must already exist (see MkdirAll).
func (fs *LocalFilesystem) WriteFile(key string, data []byte, mode os.FileMode) error {
	return os.WriteFile(key, data, mode)
}

// MkdirAll creates key and any missing parents.
func (fs *LocalFilesystem) MkdirAll(key string, perm os.FileMode) error {
	return os.MkdirAll(key, perm)
}

// OpenWriter opens key for writing (O_CREATE|O_WRONLY|O_TRUNC) with the given
// default mode and returns a streaming writer.
func (fs *LocalFilesystem) OpenWriter(key string) (io.WriteCloser, error) {
	return os.OpenFile(key, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
}

// Stat reports the file at key.
func (fs *LocalFilesystem) Stat(key string) (os.FileInfo, error) {
	return os.Stat(key)
}

// Remove deletes the file at key.
func (fs *LocalFilesystem) Remove(key string) error {
	return os.Remove(key)
}

// RemoveAll removes key and everything it contains.
func (fs *LocalFilesystem) RemoveAll(key string) error {
	return os.RemoveAll(key)
}
