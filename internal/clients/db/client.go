// Package db provides a dialect-aware wrapper around database/sql. It is the
// database counterpart to the storage client abstraction: a config-based
// factory (NewClient) dispatches to the right driver, and the returned Client
// carries its dialect so repositories can write one set of queries and adapt
// placeholder/DDL/insert-ID behavior per database type.
//
// It belongs to the clients tier: feature repositories construct a Client from
// per-user configuration instead of importing a driver directly, keeping
// platform specifics out of business logic. Adding a new database type (e.g.
// MySQL) means adding a Dialect, an open path and extending Rebind.
package db

import (
	"database/sql"
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	_ "github.com/lib/pq"
	_ "modernc.org/sqlite"
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

// NewClient opens a connection to the database described by config, verifies
// the connection is live and returns a dialect-aware Client. Table creation is
// intentionally NOT done here; each feature repository owns its schema via
// initializeTable.
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

// openPostgreSQL opens a PostgreSQL connection from the host/port/database/
// username/password fields and verifies it is reachable. The DSN is built as a
// URL so special characters in the password are escaped correctly.
func openPostgreSQL(config Config) (*Client, error) {
	if config.Host == "" || config.Database == "" || config.Username == "" {
		return nil, fmt.Errorf("postgresql requires host, database and username")
	}

	port := config.Port
	if port == 0 {
		port = 5432
	}

	u := url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(config.Username, config.Password),
		Host:   net.JoinHostPort(config.Host, strconv.Itoa(port)),
		Path:   config.Database,
	}
	q := u.Query()
	q.Set("sslmode", "disable")
	u.RawQuery = q.Encode()

	db, err := sql.Open("postgres", u.String())
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}
	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}
	return &Client{DB: db, Dialect: PostgreSQL}, nil
}

// Rebind adapts a query written with "?" placeholders to the given dialect.
// SQLite keeps "?"; PostgreSQL uses numbered "$1, $2, ..." placeholders. The
// rewrite is a simple scan, which is safe for the controlled queries in this
// codebase (none contain a literal "?" inside a string).
func Rebind(query string, dialect Dialect) string {
	if dialect != PostgreSQL {
		return query
	}

	var sb strings.Builder
	sb.Grow(len(query) + 8)
	n := 0
	for _, r := range query {
		if r == '?' {
			n++
			sb.WriteByte('$')
			sb.WriteString(strconv.Itoa(n))
		} else {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}
