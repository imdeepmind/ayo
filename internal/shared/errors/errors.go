// Package errors centralizes the user-facing errors shared across features.
//
// It belongs to the shared tier: feature services return these errors (instead
// of wrapped fmt errors) so the frontend can display a friendly message.
//
// Two kinds of errors live here:
//   - sentinel errors (Err*) for known, expected states a user can recover
//     from (e.g. "user already exists", "invalid password");
//   - the InternalServerError type for unexpected failures, which carries the
//     underlying cause for logging while keeping the message vague.
package errors

import (
	"errors"
	"log/slog"
)

// Sentinel errors are compared with == (or errors.Is). They are all phrased as
// complete user-facing messages since the frontend surfaces them directly.
var (
	// ErrInvalidInput means the request payload failed validation.
	ErrInvalidInput = errors.New(
		"the information you provided is incomplete or invalid. Please review your input and try again",
	)

	// ErrUserAlreadyExists means the requested username is already taken.
	ErrUserAlreadyExists = errors.New(
		"an account with this username already exists. Please choose a different username or sign in instead",
	)

	// ErrDatabaseError means a persistence operation could not be completed.
	ErrDatabaseError = errors.New(
		"we're unable to process your request at the moment. Please try again shortly",
	)

	// ErrUserNotFound and ErrInvalidPassword deliberately share one message
	// ("invalid username or password") so that login responses do not reveal
	// whether a username exists.
	ErrUserNotFound = errors.New(
		"invalid username or password",
	)

	ErrInvalidPassword = errors.New(
		"invalid username or password",
	)

	// ErrInvalidRecoveryKey means the provided recovery key did not match.
	ErrInvalidRecoveryKey = errors.New(
		"the recovery key you entered is incorrect. Please check it and try again",
	)

	// ErrUnauthorized means the caller is not signed in.
	ErrUnauthorized = errors.New(
		"you must be logged in to access this resource",
	)

	// ErrJobNotFound means the requested queue entry does not exist.
	ErrJobNotFound = errors.New(
		"the file entry you are looking for no longer exists",
	)
)

// InternalServerError is the typed representation of an unexpected failure
// inside the application. Its message is intentionally vague so no internal
// detail ever reaches the user; the underlying cause is preserved for
// diagnostics and can be retrieved via Unwrap.
//
// This is the shared internal-failure error for all services. Construct it with
// NewInternalServerError and detect it with errors.As (or the standard
// library's errors.As).
type InternalServerError struct {
	operation string
	cause     error
}

// NewInternalServerError wraps an internal failure with a vague, user-safe
// message while keeping the original cause for logging.
func NewInternalServerError(operation string, cause error) error {
	return &InternalServerError{operation: operation, cause: cause}
}

// Error returns the user-facing message.
func (e *InternalServerError) Error() string {
	return "something went wrong on our side. Please try again later"
}

// Unwrap exposes the underlying cause for diagnostics.
func (e *InternalServerError) Unwrap() error {
	return e.cause
}

// AsInternalServerError returns a vague *InternalServerError for the user while
// logging the underlying cause for diagnostics. If err is already an
// InternalServerError it is returned unchanged so the original cause is never
// double-wrapped.
//
// Callers should handle expected sentinels (Err*) themselves before calling
// this; it is only for unexpected/internal failures.
func AsInternalServerError(operation string, err error) error {
	var ise *InternalServerError
	if errors.As(err, &ise) {
		return err
	}
	slog.Error(operation, "error", err)
	return NewInternalServerError(operation, err)
}
