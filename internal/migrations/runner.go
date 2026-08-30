// Package migrations owns all database schema definitions and their evolution.
// SQL migration files live in the sqlite/ and postgresql/ subdirectories, named
// NNN_description.sql where NNN is a monotonically increasing version number.
// The Runner reads these embedded files, compares their versions against the
// schema_migrations bookkeeping table, and applies any pending migrations in
// order inside individual transactions.
//
// Adding a schema change in the future requires only a new numbered SQL file
// in each dialect directory — no Go code changes.
package migrations

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"regexp"
	"sort"
	"strconv"
	"strings"

	dbclient "ayo/internal/clients/db"
)

//go:embed sqlite postgresql
var sqlFiles embed.FS

// versionRegex extracts the leading numeric version from a migration filename
// such as "001_initial_schema.sql".
var versionRegex = regexp.MustCompile(`^(\d+)_`)

// migration holds a parsed SQL migration file ready to apply.
type migration struct {
	Version int
	Name    string // filename without directory prefix
	SQL     string // full file contents
}

// Runner applies pending SQL migrations to a database in version order.
// It has no mutable state; the zero value is ready to use.
type Runner struct{}

// New returns a Runner. It satisfies dbclient.MigrationRunner.
func New() *Runner { return &Runner{} }

// Run bootstraps the schema_migrations bookkeeping table if it does not yet
// exist, finds the highest version already applied, and then runs every
// migration file whose version is greater — in ascending order, each in its
// own transaction. If any migration fails its transaction is rolled back, the
// version is not recorded, and Run returns an error immediately so the caller
// can surface a meaningful message rather than letting the app start against
// an incomplete schema.
func (r *Runner) Run(ctx context.Context, db *dbclient.Client) error {
	if err := createMigrationsTable(ctx, db); err != nil {
		return fmt.Errorf("migrations: bootstrap schema_migrations: %w", err)
	}

	var last int
	if err := db.QueryRowContext(ctx,
		"SELECT COALESCE(MAX(version), 0) FROM schema_migrations").Scan(&last); err != nil {
		return fmt.Errorf("migrations: query last applied version: %w", err)
	}

	subdir := "sqlite"
	if db.IsPostgres() {
		subdir = "postgresql"
	}

	pending, err := loadMigrations(subdir, last)
	if err != nil {
		return fmt.Errorf("migrations: load migration files: %w", err)
	}

	for _, m := range pending {
		slog.Info("migrations: applying migration", "version", m.Version, "name", m.Name)
		if err := applyMigration(ctx, db, m); err != nil {
			return fmt.Errorf("migrations: apply %s (version %d): %w", m.Name, m.Version, err)
		}
		slog.Info("migrations: migration applied", "version", m.Version, "name", m.Name)
	}

	return nil
}

// createMigrationsTable idempotently creates the schema_migrations bookkeeping
// table. The timestamp type differs by dialect but the table structure is the
// same: a single integer primary key (the migration version) and a server-side
// timestamp recording when it was applied.
func createMigrationsTable(ctx context.Context, db *dbclient.Client) error {
	tsType := "DATETIME"
	if db.IsPostgres() {
		tsType = "TIMESTAMP"
	}
	_, err := db.ExecContext(ctx, fmt.Sprintf(
		`CREATE TABLE IF NOT EXISTS schema_migrations (`+
			`version INTEGER PRIMARY KEY, `+
			`applied_at %s NOT NULL DEFAULT CURRENT_TIMESTAMP`+
			`)`, tsType))
	return err
}

// loadMigrations reads all .sql files from the given subdirectory of the
// embedded FS, parses the leading version number from each filename, and
// returns only the migrations whose version is strictly greater than last,
// sorted ascending by version.
func loadMigrations(subdir string, last int) ([]migration, error) {
	entries, err := fs.ReadDir(sqlFiles, subdir)
	if err != nil {
		return nil, fmt.Errorf("read %s directory: %w", subdir, err)
	}

	var migrations []migration
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		matches := versionRegex.FindStringSubmatch(e.Name())
		if matches == nil {
			// File doesn't start with a version number — skip it silently so
			// README.md or other non-migration files in the dir are ignored.
			continue
		}
		version, err := strconv.Atoi(matches[1])
		if err != nil {
			continue
		}
		if version <= last {
			continue // already applied
		}
		data, err := fs.ReadFile(sqlFiles, subdir+"/"+e.Name())
		if err != nil {
			return nil, fmt.Errorf("read migration file %s: %w", e.Name(), err)
		}
		migrations = append(migrations, migration{
			Version: version,
			Name:    e.Name(),
			SQL:     string(data),
		})
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})
	return migrations, nil
}

// applyMigration runs a single migration file inside an explicit transaction.
// The SQL file content is split into individual statements on semicolons so
// that multi-statement files execute correctly across both drivers. The version
// row is inserted inside the same transaction, so a failure rolls back both the
// DDL and the bookkeeping row atomically.
func applyMigration(ctx context.Context, db *dbclient.Client, m migration) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	for _, stmt := range splitSQL(m.SQL) {
		if _, err := tx.ExecContext(ctx, stmt); err != nil {
			return fmt.Errorf("execute %q: %w", truncate(stmt, 80), err)
		}
	}

	// Record the version inside the same transaction so it is only committed
	// if all DDL statements above succeeded.
	if _, err := tx.ExecContext(ctx,
		db.Rebind("INSERT INTO schema_migrations (version) VALUES (?)"),
		m.Version,
	); err != nil {
		return fmt.Errorf("record version %d: %w", m.Version, err)
	}

	return tx.Commit()
}

// splitSQL splits a SQL script on semicolons, trims whitespace from each
// piece, and discards empty results. This lets migration files be written as
// plain SQL without manual statement delimiting in Go.
func splitSQL(sql string) []string {
	parts := strings.Split(sql, ";")
	stmts := make([]string, 0, len(parts))
	for _, p := range parts {
		if s := strings.TrimSpace(p); s != "" {
			stmts = append(stmts, s)
		}
	}
	return stmts
}

// truncate returns s truncated to n bytes with "…" appended when it is longer.
// Used to keep error messages readable when a long SQL statement fails.
func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
