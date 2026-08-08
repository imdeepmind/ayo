package dbconfig

import (
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"ayo/internal/platform/keyring"
)

// ErrCredentialsNotFound is returned by Load when no database-credentials entry
// exists for the user. It is an internal marker (mapped by the auth service to
// ErrUserNotFound) rather than a user-facing message.
var ErrCredentialsNotFound = errors.New("database credentials not found in keyring")

// Repository abstracts persistence of the encrypted database-credentials blob
// in the OS keyring. It mirrors the settings feature's keyring repository: the
// blob is base64-encoded and stored under the "ayo" service, keyed by user.
type Repository interface {
	// Load returns the encrypted credentials blob, or ErrCredentialsNotFound
	// when nothing has been saved yet.
	Load(username string) ([]byte, error)
	// Save replaces the encrypted credentials blob for the given user.
	Save(username string, data []byte) error
}

type repository struct{}

// NewRepository returns a ready-to-use keyring repository.
func NewRepository() Repository {
	return &repository{}
}

// keyringUser maps an account username to the keyring entry holding its
// database credentials, keeping it separate from the "ayo" entries used by
// settings.
func keyringUser(username string) string {
	return "dbcreds_" + username
}

func (r *repository) Load(username string) ([]byte, error) {
	encoded, err := keyring.Get("ayo", keyringUser(username))
	if err != nil {
		if isKeyringNotFound(err) {
			return nil, ErrCredentialsNotFound
		}
		return nil, fmt.Errorf("load database credentials from keyring: %w", err)
	}

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("decode database credentials blob: %w", err)
	}
	return decoded, nil
}

func (r *repository) Save(username string, data []byte) error {
	encoded := base64.StdEncoding.EncodeToString(data)
	if err := keyring.Set("ayo", keyringUser(username), encoded); err != nil {
		return fmt.Errorf("save database credentials to keyring: %w", err)
	}
	return nil
}

// isKeyringNotFound reports whether a keyring lookup failed because nothing is
// stored for the given user. The not-found marker differs across platforms and
// OS versions, so this matches both the library's sentinel error and the
// platform error text (e.g. macOS `security` prints "could not be found").
func isKeyringNotFound(err error) bool {
	if errors.Is(err, keyring.ErrNotFound) {
		return true
	}
	msg := err.Error()
	return strings.Contains(msg, "could not be found") ||
		strings.Contains(msg, "item not found") ||
		strings.Contains(msg, "no entry") ||
		strings.Contains(msg, "not exist")
}
