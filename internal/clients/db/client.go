// Package db provides a dialect-aware wrapper around database/sql. It is the
// database counterpart to the storage client abstraction: a config-based
// factory (NewClient) dispatches to the right driver, and the returned Client
// carries its dialect so repositories can write one set of queries and adapt
// placeholder/DDL/insert-ID behavior per database type.
//
// The layout mirrors internal/clients/storage: shared types and dispatch live
// here, and each driver has its own file (sqlite.go, postgresql.go). Adding a
// new database type (e.g. MySQL) means adding a Dialect, an open<Driver> path
// and extending Rebind.
package db

import (
	"database/sql"
	"errors"
	"fmt"
	"sync"
)

// ErrNoConnection is returned by Connection.Current when no database connection
// is active (i.e. nobody is signed in).
var ErrNoConnection = errors.New("no active database connection")

// Dialect identifies a supported database engine.
type Dialect string

const (
	// SQLite is the embedded file-based database (modernc.org/sqlite).
	SQLite Dialect = "sqlite"
	// PostgreSQL is a remote server database (github.com/lib/pq).
	PostgreSQL Dialect = "postgresql"
)

// Config describes how to connect to a database. Type determines which fields
// apply: SQLite uses Path; PostgreSQL uses Host, Port, Database, Username and
// Password.
type Config struct {
	Type     Dialect `json:"Type"`
	Path     string  `json:"Path,omitempty"`
	Host     string  `json:"Host,omitempty"`
	Port     int     `json:"Port,omitempty"`
	Database string  `json:"Database,omitempty"`
	Username string  `json:"Username,omitempty"`
	Password string  `json:"Password,omitempty"`
}

// Client is a live database connection plus the dialect it was opened with. It
// embeds *sql.DB so all existing database/sql calls keep working unchanged.
type Client struct {
	*sql.DB
	Dialect Dialect
}

// NewClient opens a connection to the database described by config, verifies
// the connection is live and returns a dialect-aware Client. It dispatches to
// the driver-specific open functions. Table creation is intentionally NOT done
// here; each feature repository owns its schema via initializeTable.
func NewClient(config Config) (*Client, error) {
	switch config.Type {
	case SQLite:
		return openSQLite(config)
	case PostgreSQL:
		return openPostgreSQL(config)
	default:
		return nil, fmt.Errorf("unsupported database type %q", config.Type)
	}
}

// Validate verifies a database described by config is reachable before the
// credentials are persisted. It is used by registration to surface bad
// PostgreSQL credentials (or an unwritable SQLite location) up front.
func Validate(config Config) error {
	client, err := NewClient(config)
	if err != nil {
		return err
	}
	return client.Close()
}

// IsPostgres reports whether the client is connected to PostgreSQL. Repositories
// branch on this to pick dialect-specific DDL, RETURNING clauses and error
// matching.
func (c *Client) IsPostgres() bool {
	return c.Dialect == PostgreSQL
}

// Rebind adapts a query written with "?" placeholders to the client's dialect.
// It is a no-op for SQLite and rewrites "?" to "$1, $2, ..." for PostgreSQL.
func (c *Client) Rebind(query string) string {
	return Rebind(query, c.Dialect)
}

// LastInsertID returns the last inserted row ID for the given result. SQLite
// exposes it via database/sql; PostgreSQL has no equivalent, so callers on that
// dialect must use an INSERT ... RETURNING id query instead. The returned error
// forces that path rather than silently returning a bogus 0.
func (c *Client) LastInsertID(result sql.Result) (int64, error) {
	if c.IsPostgres() {
		return 0, fmt.Errorf("postgresql does not support LastInsertId; use a RETURNING clause")
	}
	return result.LastInsertId()
}

// Connection is a shared holder for the active per-user database client. With
// per-user databases there is no single connection for the app's lifetime: the
// auth service opens a user's database on login and clears it on logout.
// Repositories constructed with a Connection resolve the current client on each
// operation, so one repository instance safely serves whichever user is signed
// in, and tables are initialized lazily against that user's database.
type Connection struct {
	mu     sync.RWMutex
	client *Client
}

// NewConnection returns an empty connection holder with no active client.
func NewConnection() *Connection {
	return &Connection{}
}

// Set replaces the active client with a new one, closing the previous if any.
// It is called by the auth service after opening a user's database.
func (c *Connection) Set(client *Client) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.client != nil && c.client != client {
		_ = c.client.Close()
	}
	c.client = client
}

// Current returns the active client, or ErrNoConnection when none is set (no
// user signed in).
func (c *Connection) Current() (*Client, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.client == nil {
		return nil, ErrNoConnection
	}
	return c.client, nil
}

// Close closes the active client (if any) and clears the connection. Called on
// logout.
func (c *Connection) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.client != nil {
		_ = c.client.Close()
		c.client = nil
	}
}
