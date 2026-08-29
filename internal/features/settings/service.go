package settings

import (
	"context"
	"encoding/json"

	dbclient "ayo/internal/clients/db"
	"ayo/internal/features/auth"
	"ayo/internal/shared/crypto"
	"ayo/internal/shared/dialog"
	"ayo/internal/shared/errors"

	"github.com/go-playground/validator/v10"
)

// SessionProvider is the subset of auth.Service that settings depends on.
type SessionProvider interface {
	RequireSession() (*auth.Session, error)
}

// DatabaseConfigProvider exposes the signed-in user's database configuration so
// the read-only Database settings page can display it. It is implemented by the
// auth service and injected here to keep settings decoupled from auth internals.
type DatabaseConfigProvider interface {
	DatabaseConfig() (dbclient.Config, error)
}

// ProviderValidator validates a configured storage provider is usable before
// settings are saved (e.g. a local folder is creatable or an AWS bucket is
// reachable). It is implemented outside this package by the storage client and
// injected here to keep settings decoupled from the storage implementation.
type ProviderValidator interface {
	Validate(key CloudKey) error
}

// DatabaseInfo is the sanitized, read-only description of the signed-in user's
// database. It deliberately excludes the database password.
type DatabaseInfo struct {
	Type     dbclient.Dialect `json:"Type"`
	Path     string           `json:"Path,omitempty"`
	Host     string           `json:"Host,omitempty"`
	Port     int              `json:"Port,omitempty"`
	Database string           `json:"Database,omitempty"`
	Username string           `json:"Username,omitempty"`
}

type Service struct {
	ctx               context.Context
	sessionProvider   SessionProvider
	dbConfigProvider  DatabaseConfigProvider
	providerValidator ProviderValidator
	repo              Repository
	validate          *validator.Validate
}

func NewService(sessionProvider SessionProvider, dbConfigProvider DatabaseConfigProvider,
	providerValidator ProviderValidator, repo Repository) *Service {
	return &Service{
		sessionProvider:   sessionProvider,
		dbConfigProvider:  dbConfigProvider,
		providerValidator: providerValidator,
		repo:              repo,
		validate:          validator.New(),
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

	decryptedData, err := crypto.DecryptData(session.MasterKey(), data)
	if err != nil {
		return nil, errors.AsInternalServerError("get settings: decrypt", err)
	}

	var parsedSettings Settings
	if err := json.Unmarshal(decryptedData, &parsedSettings); err != nil {
		return nil, errors.AsInternalServerError("get settings: unmarshal", err)
	}
	return &parsedSettings, nil
}

// GetDatabaseInfo returns the signed-in user's database configuration for the
// read-only Database settings page. The password is never included.
func (s *Service) GetDatabaseInfo() (*DatabaseInfo, error) {
	config, err := s.dbConfigProvider.DatabaseConfig()
	if err != nil {
		return nil, err
	}
	return &DatabaseInfo{
		Type:     config.Type,
		Path:     config.Path,
		Host:     config.Host,
		Port:     config.Port,
		Database: config.Database,
		Username: config.Username,
	}, nil
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

	if err := normalizeProviderIDs(input.CloudKeys); err != nil {
		return errors.AsInternalServerError("update settings: assign provider ids", err)
	}

	// Verify each configured provider is usable before persisting, so a bad
	// bucket or unwritable folder is reported to the user immediately rather
	// than failing later during an upload.
	for _, key := range input.CloudKeys {
		if err := s.providerValidator.Validate(key); err != nil {
			return err
		}
	}

	data, err := json.Marshal(input)
	if err != nil {
		return errors.AsInternalServerError("update settings: marshal", err)
	}

	encryptedData, err := crypto.EncryptData(session.MasterKey(), data)
	if err != nil {
		return errors.AsInternalServerError("update settings: encrypt", err)
	}

	if err := s.repo.Save(session.Username, encryptedData); err != nil {
		return errors.AsInternalServerError("update settings: save", err)
	}
	return nil
}
