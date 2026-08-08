package db

import (
	"path/filepath"
	"testing"
)

func TestRebind(t *testing.T) {
	const query = "INSERT INTO users (a, b, c) VALUES (?, ?, ?) WHERE x = ?"

	if got := Rebind(query, SQLite); got != query {
		t.Fatalf("sqlite should be a no-op, got %q", got)
	}

	want := "INSERT INTO users (a, b, c) VALUES ($1, $2, $3) WHERE x = $4"
	if got := Rebind(query, PostgreSQL); got != want {
		t.Fatalf("postgres rebind: got %q want %q", got, want)
	}
}

func TestRebindNoPlaceholders(t *testing.T) {
	const query = "SELECT id, username FROM users"
	if got := Rebind(query, PostgreSQL); got != query {
		t.Fatalf("query without placeholders should be unchanged, got %q", got)
	}
}

func TestNewClientDispatch(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.db")

	client, err := NewClient(Config{Type: SQLite, Path: path})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer client.Close()

	if client.Dialect != SQLite {
		t.Fatalf("expected sqlite dialect, got %q", client.Dialect)
	}
	if client.IsPostgres() {
		t.Fatal("sqlite client should not report postgres")
	}

	// Unsupported type must error.
	if _, err := NewClient(Config{Type: "mysql"}); err == nil {
		t.Fatal("expected error for unsupported database type")
	}

	// SQLite requires a path.
	if _, err := NewClient(Config{Type: SQLite}); err == nil {
		t.Fatal("expected error for sqlite without a path")
	}
}
