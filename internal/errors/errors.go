package errors

import "errors"

var (
	ErrInvalidInput = errors.New(
		"the information you provided is incomplete or invalid. Please review your input and try again",
	)

	ErrUserAlreadyExists = errors.New(
		"an account with this username already exists. Please choose a different username or sign in instead",
	)

	ErrInternalServer = errors.New(
		"something went wrong on our side. Please try again later",
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
