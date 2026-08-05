package settings

import (
	"context"
	"encoding/json"

	"ayo/internal/features/auth"
	"ayo/internal/platform/dialog"
	"ayo/internal/shared/crypto"
	"ayo/internal/shared/errors"

	"github.com/go-playground/validator/v10"
)

// SessionProvider is the subset of auth.Service that settings depends on.
type SessionProvider interface {
	RequireSession() (*auth.Session, error)
}

type Service struct {
	ctx             context.Context
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

// Startup is called by Wails on application startup.
func (s *Service) Startup(ctx context.Context) {
	s.ctx = ctx
}

// PickFolder opens the native directory-selection dialog and returns the chosen
// folder path. An empty string is returned when the user cancels the dialog.
func (s *Service) PickFolder() (string, error) {
	return dialog.OpenFolder(s.ctx, dialog.Options{
		Title: "Choose Local Storage Folder",
	})
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
