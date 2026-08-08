package storage

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	"ayo/internal/features/settings"
)

// LocalFilesystem is the default Client backed by the local OS filesystem. Every
// key is interpreted as a filesystem path relative to or absolute on the host.
// Permissions mirror how the upload feature manages runtime data: directories
// are created with the owner-only mode 0o700 and regular files with 0o600.
//
// It implements the portable Client interface (ReadFile, OpenWriter, Remove)
// and additionally exposes the filesystem-specific operations used by the
// upload layer for its own runtime data (WriteFile, MkdirAll, Stat, RemoveAll).
// Parent directories are created automatically: OpenWriter and WriteFile ensure
// the containing directory exists before writing, so callers never need to
// MkdirAll first.
type LocalFilesystem struct{}

// NewLocalFilesystem returns a ready-to-use local filesystem client.
func NewLocalFilesystem() *LocalFilesystem {
	return &LocalFilesystem{}
}

// ReadFile reads the whole file at key.
func (fs *LocalFilesystem) ReadFile(key string) ([]byte, error) {
	return os.ReadFile(key)
}

// OpenReader opens key for streaming read and returns an io.ReadCloser.
func (fs *LocalFilesystem) OpenReader(key string) (io.ReadCloser, error) {
	return os.Open(key)
}

// WriteFile writes data to key with the given mode, truncating any existing
// file and creating the parent directory if it is missing.
func (fs *LocalFilesystem) WriteFile(key string, data []byte, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(key), 0o700); err != nil {
		return err
	}
	return os.WriteFile(key, data, mode)
}

// MkdirAll creates key and any missing parents.
func (fs *LocalFilesystem) MkdirAll(key string, perm os.FileMode) error {
	return os.MkdirAll(key, perm)
}

// OpenWriter opens key for writing (O_CREATE|O_WRONLY|O_TRUNC) with mode 0o600,
// creating the parent directory if it is missing, and returns a streaming
// writer.
func (fs *LocalFilesystem) OpenWriter(key string) (io.WriteCloser, error) {
	if err := os.MkdirAll(filepath.Dir(key), 0o700); err != nil {
		return nil, err
	}
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

// Validate verifies a local provider's storage folder is present and creatable
// by creating FolderPath/FolderName (a side effect the shard writes rely on
// anyway). It is used to check settings before they are saved.
func (fs *LocalFilesystem) Validate(key *settings.LocalKey) error {
	if key.FolderName == "" || key.FolderPath == "" {
		return fmt.Errorf("local provider is incomplete: a folder name and location are required")
	}

	dir := filepath.Join(key.FolderPath, key.FolderName)
	if err := fs.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("unable to create local storage folder %q: %w", dir, err)
	}
	return nil
}

// ensure LocalFilesystem satisfies the Client interface at compile time.
var _ Client = (*LocalFilesystem)(nil)
