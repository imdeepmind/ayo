package keyring

import (
	go_keyring "github.com/zalando/go-keyring"
)

// ErrNotFound is returned when no entry exists for the given service/user pair.
var ErrNotFound = go_keyring.ErrNotFound

// Get returns the value stored for the given service/user pair.
func Get(service, user string) (string, error) {
	return go_keyring.Get(service, user)
}

// Set stores a value for the given service/user pair.
func Set(service, user, value string) error {
	return go_keyring.Set(service, user, value)
}
