package settings

import (
	"encoding/json"

	"ayo/internal/features/auth"
	"ayo/internal/shared/crypto"
	"ayo/internal/shared/errors"

	"github.com/go-playground/validator/v10"
)

// SessionProvider is the subset of auth.Service that settings depends on.
type SessionProvider interface {
	RequireSession() (*auth.Session, error)
}

type Service struct {
	sessionProvider SessionProvider
	repo            Repository
	validate        *validator.Validate
}

func NewService(sessionProvider SessionProvider, repo Repository) *Service {
	return &Service{
		sessionProvider: sessionProvider,
		repo:            repo,
		validate:        validator.New(),
	}
}

// GetSettings loads, decrypts and returns the current settings for the signed-in
// user. An empty Settings is returned when nothing has been saved yet.
func (s *Service) GetSettings() (*Settings, error) {
	session, err := s.sessionProvider.RequireSession()
	if err != nil {
		return nil, err
	}

	data, err := s.repo.Load(session.Username)
	if err != nil {
		return nil, errors.AsInternalServerError("get settings: load", err)
	}

	if len(data) == 0 {
		return &Settings{}, nil
	}

	decryptedData, err := crypto.DecryptData(session.MasterKey, data)
	if err != nil {
		return nil, errors.AsInternalServerError("get settings: decrypt", err)
	}

	var parsedSettings Settings
	if err := json.Unmarshal(decryptedData, &parsedSettings); err != nil {
		return nil, errors.AsInternalServerError("get settings: unmarshal", err)
	}
	return &parsedSettings, nil
}

// UpdateSettings validates, encrypts and persists the given settings for the
// signed-in user.
func (s *Service) UpdateSettings(input UpdateSettingsInput) error {
	if err := s.validate.Struct(input); err != nil {
		return errors.ErrInvalidInput
	}

	session, err := s.sessionProvider.RequireSession()
	if err != nil {
		return err
	}

	data, err := json.Marshal(input)
	if err != nil {
		return errors.AsInternalServerError("update settings: marshal", err)
	}

	encryptedData, err := crypto.EncryptData(session.MasterKey, data)
	if err != nil {
		return errors.AsInternalServerError("update settings: encrypt", err)
	}

	if err := s.repo.Save(session.Username, encryptedData); err != nil {
		return errors.AsInternalServerError("update settings: save", err)
	}
	return nil
}
