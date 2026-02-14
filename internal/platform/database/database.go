package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// NewDatabase initializes a new SQLite database connection.
// It accepts a file path (which can include directories).
// It ensures that the parent directory of the database file exists.
func NewDatabase(dbPath string) (*sql.DB, error) {
	// Ensure parent directory exists
	dir := filepath.Dir(dbPath)
	if dir != "." && dir != "/" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create database directory: %w", err)
		}
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Create table logic is separate or could be called here if idempotent.
	// But repository logic handles table creation in this codebase (InitializeTable).
	// A better place for migrations would be separate, but sticking to existing pattern.

	return db, nil
}
