package settings

import (
	"context"
	"encoding/base64"
	"errors"

	"ayo/internal/platform/keyring"
)

// Repository abstracts persistence of the raw settings blob. The blob is the
// base64-encoded, encrypted JSON stored in the OS keyring.
type Repository interface {
	// Load returns the stored blob, or nil when nothing has been saved yet.
	Load(ctx context.Context, username string) ([]byte, error)
	// Save replaces the stored blob for the given user.
	Save(ctx context.Context, username string, data []byte) error
}

type repository struct{}

func NewRepository() Repository {
	return &repository{}
}

func (r *repository) Load(ctx context.Context, username string) ([]byte, error) {
	encoded, err := keyring.Get("ayo", username)
	if err != nil {
		if errors.Is(err, keyring.ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return base64.StdEncoding.DecodeString(encoded)
}

func (r *repository) Save(ctx context.Context, username string, data []byte) error {
	encoded := base64.StdEncoding.EncodeToString(data)
	return keyring.Set("ayo", username, encoded)
}
