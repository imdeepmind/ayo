package masterkey

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"

	"ayo/internal/platform/keyring"
)

// ErrMasterKeyNotFound is returned by Load when no master-key keyring entry
// exists for the user. It signals database storage (see Repository.Exists).
var ErrMasterKeyNotFound = errors.New("master key not found in keyring")

// Repository abstracts persistence of the encrypted master-key material in the
// OS keyring. It mirrors the settings and dbconfig keyring repositories: the
// material is JSON-encoded, base64-encoded and stored under the "ayo" service,
// keyed by user ("mkey_{username}") to keep it separate from the "ayo" and
// "dbcreds_" entries.
type Repository interface {
	// Load returns the stored material, or ErrMasterKeyNotFound when nothing
	// has been saved yet.
	Load(username string) (*Material, error)
	// Save replaces the stored material for the given user.
	Save(username string, material *Material) error
	// Delete removes the stored material for the given user. Removing an entry
	// that does not exist is not an error.
	Delete(username string) error
	// Exists reports whether a keyring entry is stored for the user. This is
	// the source of truth for the storage state: present => keyring storage,
	// absent => database storage.
	Exists(username string) (bool, error)
}

type repository struct{}

// NewRepository returns a ready-to-use keyring repository.
func NewRepository() Repository {
	return &repository{}
}

// keyringUser maps an account username to the keyring entry holding its
// encrypted master-key material.
func keyringUser(username string) string {
	return "mkey_" + username
}

func (r *repository) Load(username string) (*Material, error) {
	encoded, err := keyring.Get("ayo", keyringUser(username))
	if err != nil {
		if keyring.IsNotFound(err) {
			return nil, ErrMasterKeyNotFound
		}
		return nil, fmt.Errorf("load master key from keyring: %w", err)
	}

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("decode master key blob: %w", err)
	}

	var material Material
	if err := json.Unmarshal(decoded, &material); err != nil {
		return nil, fmt.Errorf("unmarshal master key blob: %w", err)
	}
	return &material, nil
}

func (r *repository) Save(username string, material *Material) error {
	raw, err := json.Marshal(material)
	if err != nil {
		return fmt.Errorf("marshal master key blob: %w", err)
	}
	encoded := base64.StdEncoding.EncodeToString(raw)
	if err := keyring.Set("ayo", keyringUser(username), encoded); err != nil {
		return fmt.Errorf("save master key to keyring: %w", err)
	}
	return nil
}

func (r *repository) Delete(username string) error {
	if err := keyring.Delete("ayo", keyringUser(username)); err != nil {
		return fmt.Errorf("delete master key from keyring: %w", err)
	}
	return nil
}

func (r *repository) Exists(username string) (bool, error) {
	return keyring.Exists("ayo", keyringUser(username))
}

// GenerateJunk returns a Material filled with random bytes sized like real
// encrypted master-key material. It is written to the users table columns while
// the real material lives in the OS keyring, so a stolen database offers no
// usable key material and the junk is indistinguishable from the real ciphertext
// (same lengths: 16-byte salts, 12-byte nonces, 48-byte wrapped keys).
func GenerateJunk() (*Material, error) {
	bytes := func(n int) ([]byte, error) {
		b := make([]byte, n)
		if _, err := rand.Read(b); err != nil {
			return nil, err
		}
		return b, nil
	}

	passwordSalt, err := bytes(16)
	if err != nil {
		return nil, fmt.Errorf("generate junk password salt: %w", err)
	}
	passwordNonce, err := bytes(12)
	if err != nil {
		return nil, fmt.Errorf("generate junk password nonce: %w", err)
	}
	passwordMasterKey, err := bytes(48)
	if err != nil {
		return nil, fmt.Errorf("generate junk password master key: %w", err)
	}
	recoverySalt, err := bytes(16)
	if err != nil {
		return nil, fmt.Errorf("generate junk recovery salt: %w", err)
	}
	recoveryNonce, err := bytes(12)
	if err != nil {
		return nil, fmt.Errorf("generate junk recovery nonce: %w", err)
	}
	recoveryMasterKey, err := bytes(48)
	if err != nil {
		return nil, fmt.Errorf("generate junk recovery master key: %w", err)
	}

	return &Material{
		PasswordSalt:      passwordSalt,
		PasswordNonce:     passwordNonce,
		PasswordMasterKey: passwordMasterKey,
		RecoverySalt:      recoverySalt,
		RecoveryNonce:     recoveryNonce,
		RecoveryMasterKey: recoveryMasterKey,
	}, nil
}
