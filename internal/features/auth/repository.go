package auth

import (
	"context"
	"database/sql"
	stderrors "errors"
	"fmt"
	"strings"
	"sync"

	dbclient "ayo/internal/clients/db"
	"ayo/internal/features/masterkey"
	"ayo/internal/shared/errors"
)

// Repository abstracts persistence for the auth module. Keeping it behind an
// interface makes the service testable with a fake implementation instead of a
// real SQLite database.
type Repository interface {
	CreateUser(
		ctx context.Context,
		username string,
		passwordHash string,
		recoveryKey string,
		passwordSalt []byte,
		passwordNonce []byte,
		passwordMasterKey []byte,
		recoverySalt []byte,
		recoveryNonce []byte,
		recoveryMasterKey []byte,
	) (*User, error)
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	UpdateUserHashes(
		ctx context.Context,
		id int64,
		passwordHash string,
		recoveryKey string,
	) error
	UpdateMasterKeyMaterial(ctx context.Context, id int64, material *masterkey.Material) error
}

type repository struct {
	conn       *dbclient.Connection
	initMu     sync.Mutex
	initClient *dbclient.Client
}

// NewRepository returns a repository bound to the shared connection holder. The
// users table is created lazily on the active client (see resolve), since there
// is no database connection before a user signs in.
func NewRepository(conn *dbclient.Connection) Repository {
	return &repository{conn: conn}
}

// resolve returns the active client for the current session, creating the
// feature's tables on it the first time it is seen. Each user's database is
// initialized once, on first access after login (or registration).
func (r *repository) resolve() (*dbclient.Client, error) {
	c, err := r.conn.Current()
	if err != nil {
		return nil, err
	}
	r.initMu.Lock()
	defer r.initMu.Unlock()
	if r.initClient != c {
		if err := initializeTable(c); err != nil {
			return nil, err
		}
		r.initClient = c
	}
	return c, nil
}

// initializeTable idempotently ensures the users table exists. It stores only
// hashes and encrypted material - never plaintext credentials. Column types use
// BYTEA notation but SQLite is untyped, so []byte values are stored as blobs;
// PostgreSQL stores them in native BYTEA columns. The id column and DDL differ
// per dialect.
func initializeTable(db *dbclient.Client) error {
	idColumn := "id INTEGER PRIMARY KEY AUTOINCREMENT"
	if db.IsPostgres() {
		idColumn = "id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY"
	}

	query := `CREATE TABLE IF NOT EXISTS users (
		` + idColumn + `,
		username VARCHAR(255) NOT NULL UNIQUE,
		password_hash VARCHAR(255) NOT NULL,
		recovery_key VARCHAR(255) NOT NULL,

		password_salt BYTEA NOT NULL,
		password_nonce BYTEA NOT NULL,
		password_master_key BYTEA NOT NULL,

		recovery_salt BYTEA NOT NULL,
		recovery_nonce BYTEA NOT NULL,
		recovery_master_key BYTEA NOT NULL
	)`

	_, err := db.Exec(query)
	if err != nil {
		return err
	}
	return nil
}

// CreateUser inserts a new account row and returns the created User populated
// with its assigned ID. A duplicate username surfaces as ErrUserAlreadyExists.
func (r *repository) CreateUser(
	ctx context.Context,
	username string,
	passwordHash string,
	recoveryKey string,
	passwordSalt []byte,
	passwordNonce []byte,
	passwordMasterKey []byte,
	recoverySalt []byte,
	recoveryNonce []byte,
	recoveryMasterKey []byte,
) (*User, error) {
	query := `INSERT INTO users (username, password_hash, recovery_key, password_salt, ` +
		`password_nonce, password_master_key, recovery_salt, recovery_nonce, ` +
		`recovery_master_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`

	args := []any{
		username, passwordHash, recoveryKey, passwordSalt,
		passwordNonce, passwordMasterKey, recoverySalt, recoveryNonce,
		recoveryMasterKey,
	}

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}

	var id int64
	if client.IsPostgres() {
		// PostgreSQL has no LastInsertId; fetch the assigned ID via RETURNING.
		err := client.QueryRowContext(ctx, client.Rebind(query)+" RETURNING id", args...).Scan(&id)
		if err != nil {
			if strings.Contains(err.Error(), "duplicate key value violates unique constraint") {
				return nil, errors.ErrUserAlreadyExists
			}
			return nil, fmt.Errorf("failed to create user: %w", err)
		}
	} else {
		result, err := client.ExecContext(ctx, client.Rebind(query), args...)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE constraint failed") || strings.Contains(err.Error(), "Duplicate entry") {
				return nil, errors.ErrUserAlreadyExists
			}
			return nil, fmt.Errorf("failed to create user: %w", err)
		}
		id, err = client.LastInsertID(result)
		if err != nil {
			return nil, fmt.Errorf("failed to get last insert id: %w", err)
		}
	}

	user := &User{
		ID:           id,
		Username:     username,
		PasswordHash: passwordHash,
		RecoveryKey:  recoveryKey,
	}

	return user, nil
}

// GetUserByUsername fetches a user by exact username match. It returns
// ErrUserNotFound when no such account exists.
func (r *repository) GetUserByUsername(ctx context.Context, username string) (*User, error) {
	query := `SELECT id, username, password_hash, recovery_key, password_salt, ` +
		`password_master_key, password_nonce, recovery_salt, recovery_master_key, ` +
		`recovery_nonce FROM users WHERE username = ?`

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}
	row := client.QueryRowContext(ctx, client.Rebind(query), username)

	var user User
	err = row.Scan(
		&user.ID, &user.Username, &user.PasswordHash, &user.RecoveryKey,
		&user.PasswordSalt, &user.PasswordMasterKey, &user.PasswordNonce,
		&user.RecoverySalt, &user.RecoveryMasterKey, &user.RecoveryNonce,
	)
	if err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return nil, errors.ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return &user, nil
}

// UpdateUserHashes replaces the password and recovery-key bcrypt hashes for the
// given user. Used by the reset-password flow; the encrypted master-key material
// is updated separately (see UpdateMasterKeyMaterial) so that keyring-stored
// accounts keep junk in the database.
func (r *repository) UpdateUserHashes(
	ctx context.Context,
	id int64,
	passwordHash string,
	recoveryKey string,
) error {
	query := `UPDATE users SET password_hash = ?, recovery_key = ? WHERE id = ?`

	client, err := r.resolve()
	if err != nil {
		return err
	}
	_, err = client.ExecContext(
		ctx,
		client.Rebind(query),
		passwordHash, recoveryKey, id,
	)
	if err != nil {
		return fmt.Errorf("failed to update user hashes: %w", err)
	}
	return nil
}

// UpdateMasterKeyMaterial replaces the six encrypted master-key columns for the
// given user. It is used to migrate the material between the users table and
// the OS keyring: when the material moves to the keyring, this writes
// indistinguishable random junk; when it moves back, it writes the real values.
func (r *repository) UpdateMasterKeyMaterial(ctx context.Context, id int64, material *masterkey.Material) error {
	query := `UPDATE users SET password_salt = ?, password_nonce = ?, ` +
		`password_master_key = ?, recovery_salt = ?, recovery_nonce = ?, ` +
		`recovery_master_key = ? WHERE id = ?`

	client, err := r.resolve()
	if err != nil {
		return err
	}
	_, err = client.ExecContext(
		ctx,
		client.Rebind(query),
		material.PasswordSalt, material.PasswordNonce, material.PasswordMasterKey,
		material.RecoverySalt, material.RecoveryNonce, material.RecoveryMasterKey,
		id,
	)
	if err != nil {
		return fmt.Errorf("failed to update master key material: %w", err)
	}
	return nil
}
