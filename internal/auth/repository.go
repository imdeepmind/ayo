package auth

import (
	"ayo/internal/errors"
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type Repository interface {
	CreateUser(ctx context.Context, username string, passwordHash string, recoveryKey string) (*User, error)
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	UpdateUserPassword(ctx context.Context, id int64, passwordHash string) error
}

type repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) Repository {
	_ = initializeTable(db)
	return &repository{db: db}
}

func initializeTable(db *sql.DB) error {
	query := `CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username VARCHAR(255) NOT NULL UNIQUE,
		password_hash VARCHAR(255) NOT NULL,
		recovery_key VARCHAR(255) NOT NULL
	)`

	_, err := db.Exec(query)
	if err != nil {
		return err
	}
	return nil
}

func (r *repository) CreateUser(ctx context.Context, username string, passwordHash string, recoveryKey string) (*User, error) {
	create_user_query := `INSERT INTO users (username, password_hash, recovery_key) VALUES (?, ?, ?)`

	result, err := r.db.ExecContext(ctx, create_user_query, username, passwordHash, recoveryKey)
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

func (r *repository) GetUserByUsername(ctx context.Context, username string) (*User, error) {
	query := `SELECT id, username, password_hash, recovery_key FROM users WHERE username = ?`
	row := r.db.QueryRowContext(ctx, query, username)

	var user User
	err := row.Scan(&user.ID, &user.Username, &user.PasswordHash, &user.RecoveryKey)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return &user, nil
}

func (r *repository) UpdateUserPassword(ctx context.Context, id int64, passwordHash string) error {
	query := `UPDATE users SET password_hash = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, passwordHash, id)
	if err != nil {
		return fmt.Errorf("failed to update user password: %w", err)
	}
	return nil
}
