package repository

import (
	"ayo/backend/model"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"fmt"
)

type AuthRepository struct {
	db *sql.DB
}

func NewAuthRepository(db *sql.DB) *AuthRepository {
	return &AuthRepository{db: db}
}

func (a *AuthRepository) InitializeTable() error {
	query := `CREATE TABLE IF NOT EXISTS users (
		id INT AUTO_INCREMENT PRIMARY KEY,
		username VARCHAR(255) NOT NULL UNIQUE,
		password_hash VARCHAR(255) NOT NULL,
		recovery_key VARCHAR(255) NOT NULL
	)`

	_, err := a.db.Exec(query)
	if err != nil {
		return err
	}
	return nil
}

func GenerateRecoveryKey() (string, error) {
	const size = 32 // 256 bits

	b := make([]byte, size)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	// URL-safe, no padding
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (a *AuthRepository) CreateUser(username string, password string) (*model.User, error) {
	create_user_query := `INSERT INTO users (username, password_hash, recovery_key) VALUES (?, ?, ?)`

	recovery_key, err := GenerateRecoveryKey()
	if err != nil {
		return nil, err
	}

	result, err := a.db.Exec(create_user_query, username, password, recovery_key)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	_, err = result.RowsAffected()
	if err != nil {
		return nil, err
	}

	user := &model.User{
		ID:          id,
		Username:    username,
		RecoveryKey: recovery_key,
	}

	return user, nil
}
