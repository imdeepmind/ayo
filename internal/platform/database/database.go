// Package database provides the shared SQLite connection for the app.
//
// It belongs to the platform tier: it wraps a third-party driver
// (modernc.org/sqlite, a pure-Go driver with no cgo requirement) so that
// feature packages never deal with driver details. Features create their own
// tables idempotently via their repository's initializeTable - there is no
// central migration tool.
package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// NewDatabase opens (creating if needed) a SQLite database at dbPath and
// verifies the connection is live.
//
// dbPath may include directories; any missing parent directories are created
// automatically, so the caller does not need to set them up beforehand.
func NewDatabase(dbPath string) (*sql.DB, error) {
	// Ensure parent directory exists
	dir := filepath.Dir(dbPath)
	if dir != "." && dir != "/" {
		if err := os.MkdirAll(dir, 0750); err != nil {
			return nil, fmt.Errorf("failed to create database directory: %w", err)
		}
	}

	// DSN pragmas are applied to every new connection by the driver. WAL mode
	// lets readers run concurrently with a single writer (the upload processor
	// updates job status in the background while the frontend polls), the busy
	// timeout makes writers wait for the lock instead of failing immediately
	// with SQLITE_BUSY, and foreign_keys enforcement backs the chunks → uploads
	// relationship.
	dsn := "file:" + filepath.ToSlash(dbPath) +
		"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)"

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Ping forces the driver to actually connect, surfacing problems like a
	// missing/corrupt file at startup instead of on the first query.
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Table creation is intentionally NOT done here. Each feature repository
	// owns its own schema via initializeTable, which keeps feature migrations
	// close to the feature code rather than centralized (see e.g.
	// internal/features/auth/repository.go).

	return db, nil
}
