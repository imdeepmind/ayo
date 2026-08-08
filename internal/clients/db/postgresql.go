package db

import (
	"database/sql"
	"fmt"
	"net"
	"net/url"
	"strconv"

	_ "github.com/lib/pq"
)

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
