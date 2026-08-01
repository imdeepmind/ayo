package auth

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"ayo/internal/errors"
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
	UpdateUserPassword(
		ctx context.Context,
		id int64,
		passwordHash string,
		recoveryKey string,
		passwordMasterKey []byte,
		passwordNonce []byte,
		recoveryMasterKey []byte,
		recoveryNonce []byte,
	) error
}

type repository struct {
	db *sql.DB
}

// NewRepository opens the users table (creating it if needed) and returns a
// ready-to-use repository.
func NewRepository(db *sql.DB) (Repository, error) {
	if err := initializeTable(db); err != nil {
		return nil, errors.NewInternalServerError("initialize users table", err)
	}
	return &repository{db: db}, nil
}

// initializeTable idempotently ensures the users table exists. It stores only
// hashes and encrypted material - never plaintext credentials. Column types use
// BYTEA notation but SQLite is untyped, so []byte values are stored as blobs.
func initializeTable(db *sql.DB) error {
	query := `CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
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

	result, err := r.db.ExecContext(
		ctx,
		query,
		username, passwordHash, recoveryKey, passwordSalt,
		passwordNonce, passwordMasterKey, recoverySalt, recoveryNonce,
		recoveryMasterKey,
	)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") || strings.Contains(err.Error(), "Duplicate entry") {
			return nil, errors.ErrUserAlreadyExists
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert id: %w", err)
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
	row := r.db.QueryRowContext(ctx, query, username)

	var user User
	err := row.Scan(
		&user.ID, &user.Username, &user.PasswordHash, &user.RecoveryKey,
		&user.PasswordSalt, &user.PasswordMasterKey, &user.PasswordNonce,
		&user.RecoverySalt, &user.RecoveryMasterKey, &user.RecoveryNonce,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return &user, nil
}

// UpdateUserPassword replaces the password/recovery-key hashes and re-wraps the
// master key with the newly derived KEKs. Used by the reset-password flow.
func (r *repository) UpdateUserPassword(
	ctx context.Context,
	id int64,
	passwordHash string,
	recoveryKey string,
	passwordMasterKey []byte,
	passwordNonce []byte,
	recoveryMasterKey []byte,
	recoveryNonce []byte,
) error {
	query := `UPDATE users SET password_hash = ?, recovery_key = ?, ` +
		`password_master_key = ?, password_nonce = ?, recovery_master_key = ?, ` +
		`recovery_nonce = ? WHERE id = ?`
	_, err := r.db.ExecContext(
		ctx,
		query,
		passwordHash, recoveryKey, passwordMasterKey, passwordNonce,
		recoveryMasterKey, recoveryNonce, id,
	)
	if err != nil {
		return fmt.Errorf("failed to update user password: %w", err)
	}
	return nil
}
