package errors

import "errors"

var (
	ErrInvalidInput      = errors.New("invalid input")
	ErrUserAlreadyExists = errors.New("user already exists")
	ErrInternalServer    = errors.New("internal server error")
	ErrDatabaseError     = errors.New("database error")
	ErrUserNotFound      = errors.New("user not found")
	ErrInvalidPassword   = errors.New("invalid password")
)
