package errors

import "errors"

var (
	ErrInvalidInput = errors.New(
		"the information you provided is incomplete or invalid. Please review your input and try again",
	)

	ErrUserAlreadyExists = errors.New(
		"an account with this username already exists. Please choose a different username or sign in instead",
	)

	ErrDatabaseError = errors.New(
		"we're unable to process your request at the moment. Please try again shortly",
	)

	ErrUserNotFound = errors.New(
		"invalid username or password",
	)

	ErrInvalidPassword = errors.New(
		"invalid username or password",
	)

	ErrInvalidRecoveryKey = errors.New(
		"the recovery key you entered is incorrect. Please check it and try again",
	)

	ErrUnauthorized = errors.New(
		"you must be logged in to access this resource",
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
