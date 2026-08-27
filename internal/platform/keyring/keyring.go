// Package keyring is a thin wrapper around the OS credential store via
// zalando/go-keyring (macOS Keychain, Windows Credential Manager, libsecret).
//
// It belongs to the platform tier: feature repositories persist sensitive data
// (e.g. the settings blob) through this wrapper instead of importing the
// third-party library directly, keeping platform specifics out of business
// logic and making the dependency easy to replace or mock.
package keyring

import (
	"errors"
	"strings"

	go_keyring "github.com/zalando/go-keyring"
)

// ErrNotFound is returned when no entry exists for the given service/user pair.
// Callers can match it with errors.Is.
var ErrNotFound = go_keyring.ErrNotFound

// Get returns the value stored for the given service/user pair.
//
// The service name groups related entries (the app name, e.g. "ayo") while the
// user key identifies the specific entry, so per-user data can be stored under
// one service. Returns ErrNotFound when nothing is stored yet.
func Get(service, user string) (string, error) {
	return go_keyring.Get(service, user)
}

// Set stores a value for the given service/user pair, overwriting any existing
// entry. The value is encrypted by the OS keyring implementation.
func Set(service, user, value string) error {
	return go_keyring.Set(service, user, value)
}

// Delete removes the entry stored for the given service/user pair. Deleting an
// entry that does not exist is treated as success (idempotent), matching how
// some backends report a missing item as ErrNotFound.
func Delete(service, user string) error {
	err := go_keyring.Delete(service, user)
	if err != nil && errors.Is(err, go_keyring.ErrNotFound) {
		return nil
	}
	return err
}

// Exists reports whether an entry is stored for the given service/user pair.
func Exists(service, user string) (bool, error) {
	_, err := go_keyring.Get(service, user)
	if err != nil {
		if IsNotFound(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// IsNotFound reports whether a keyring lookup failed because nothing is stored
// for the given user. The not-found marker differs across platforms and OS
// versions, so this matches both the library's sentinel error and the platform
// error text (e.g. macOS `security` prints "could not be found"). Anything else
// is a real keychain failure and should surface as an error.
func IsNotFound(err error) bool {
	if errors.Is(err, ErrNotFound) {
		return true
	}
	msg := err.Error()
	return strings.Contains(msg, "could not be found") ||
		strings.Contains(msg, "item not found") ||
		strings.Contains(msg, "no entry") ||
		strings.Contains(msg, "not exist")
}
