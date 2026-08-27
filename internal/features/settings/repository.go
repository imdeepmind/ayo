package settings

import (
	"encoding/base64"
	"fmt"

	"ayo/internal/platform/keyring"
)

// Repository abstracts persistence of the raw settings blob. The blob is the
// base64-encoded, encrypted JSON stored in the OS keyring.
type Repository interface {
	// Load returns the stored blob, or nil when nothing has been saved yet.
	Load(username string) ([]byte, error)
	// Save replaces the stored blob for the given user.
	Save(username string, data []byte) error
}

type repository struct{}

func NewRepository() Repository {
	return &repository{}
}

func (r *repository) Load(username string) ([]byte, error) {
	encoded, err := keyring.Get("ayo", username)
	if err != nil {
		if keyring.IsNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("load settings from keyring: %w", err)
	}

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("decode settings blob: %w", err)
	}
	return decoded, nil
}

func (r *repository) Save(username string, data []byte) error {
	encoded := base64.StdEncoding.EncodeToString(data)
	if err := keyring.Set("ayo", username, encoded); err != nil {
		return fmt.Errorf("save settings to keyring: %w", err)
	}
	return nil
}
