package db

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

// NewDatabase establishes a connection to the SQLite database at the given path.
func NewDatabase(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}
