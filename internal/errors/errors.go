package errors

import "errors"

var (
	ErrInvalidInput = errors.New(
		"The information you provided is incomplete or invalid. Please review your input and try again.",
	)

	ErrUserAlreadyExists = errors.New(
		"An account with this username already exists. Please choose a different username or sign in instead.",
	)

	ErrInternalServer = errors.New(
		"Something went wrong on our side. Please try again later.",
	)

	ErrDatabaseError = errors.New(
		"We're unable to process your request at the moment. Please try again shortly.",
	)

	ErrUserNotFound = errors.New(
		"Invalid username or password.",
	)

	ErrInvalidPassword = errors.New(
		"Invalid username or password.",
	)

	ErrInvalidRecoveryKey = errors.New(
		"The recovery key you entered is incorrect. Please check it and try again.",
	)
)
