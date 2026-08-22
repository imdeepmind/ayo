package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	"ayo/internal/shared/paths"

	_ "modernc.org/sqlite"
)

// ResolveSQLitePath fills in the app-data-directory path for SQLite databases
// when the caller did not supply one, producing "{AppDataDir}/ayo/<username>.db".
func ResolveSQLitePath(config Config, username string) (Config, error) {
	if config.Type != SQLite || config.Path != "" {
		return config, nil
	}
	dir, err := paths.GetAppDataDir()
	if err != nil {
		return config, err
	}
	config.Path = filepath.Join(dir, username+".db")
	return config, nil
}

// openSQLite opens (creating if needed) a SQLite database at config.Path and
// verifies the connection is live. Missing parent directories are created
// automatically. DSN pragmas are applied to every new connection by the driver.
func openSQLite(config Config) (*Client, error) {
	if config.Path == "" {
		return nil, fmt.Errorf("sqlite database path is required")
	}

	dir := filepath.Dir(config.Path)
	if dir != "." && dir != "/" {
		if err := os.MkdirAll(dir, 0750); err != nil {
			return nil, fmt.Errorf("failed to create database directory: %w", err)
		}
	}

	// WAL mode lets readers run concurrently with a single writer (the upload
	// processor updates job status in the background while the frontend polls),
	// the busy timeout makes writers wait for the lock instead of failing
	// immediately with SQLITE_BUSY, and foreign_keys enforcement backs the
	// chunks → uploads relationship.
	dsn := "file:" + filepath.ToSlash(config.Path) +
		"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)"

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}
	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}
	return &Client{DB: db, Dialect: SQLite}, nil
}
