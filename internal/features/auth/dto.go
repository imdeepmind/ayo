package auth

import (
	dbclient "ayo/internal/clients/db"
)

// RegisterInput is the payload expected when creating a new account. Validation
// tags are enforced by go-playground/validator in Service.Register; the DB
// config is validated separately (type-specific fields).
type RegisterInput struct {
	Username string          `validate:"required,min=3,max=50,username_format"`
	Password string          `validate:"required,min=8,password_strength"`
	DBConfig dbclient.Config `json:"DBConfig"`
}

// LoginInput is the payload expected when signing in an existing account.
type LoginInput struct {
	Username string `validate:"required,username_format"`
	Password string `validate:"required"`
}

// ResetPasswordInput is the payload for recovering an account after a forgotten
// password. The user must prove ownership by supplying the recovery key that
// was shown at registration time.
type ResetPasswordInput struct {
	Username    string `validate:"required,username_format"`
	NewPassword string `validate:"required,min=8,password_strength"`
	RecoveryKey string `validate:"required"`
}

// RegisterResult is returned by Register and ResetPassword. It carries the
// affected account plus the (new) plaintext recovery key, which must be shown to
// the user exactly once so they can store it. Keeping the key out of the User
// entity guarantees it is never persisted or returned alongside hashes.
type RegisterResult struct {
	User        *User
	RecoveryKey string
}
