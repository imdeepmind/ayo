package settings

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"

	"ayo/internal/auth"
	"ayo/internal/utils"

	"github.com/zalando/go-keyring"
)

// SessionProvider is the subset of auth.Service that settings depends on.
type SessionProvider interface {
	RequireSession() (*auth.Session, error)
}

type Service struct {
	ctx             context.Context
	sessionProvider SessionProvider
}

func NewService(sessionProvider SessionProvider) *Service {
	return &Service{
		sessionProvider: sessionProvider,
	}
}

// Startup is called by Wails on application startup
func (s *Service) Startup(ctx context.Context) {
	s.ctx = ctx
}

// service method to get current state of settings
func (s *Service) GetSettings() (*Settings, error) {
	session, err := s.sessionProvider.RequireSession()
	if err != nil {
		return nil, err
	}

	data, err := keyring.Get("ayo", session.Username)
	if err != nil {
		if errors.Is(err, keyring.ErrNotFound) {
			return &Settings{}, nil
		}
		return nil, err
	}

	// decrypt the data before unmarshalling
	decodedData, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return nil, err
	}

	decryptedData, err := utils.DecryptData(session.MasterKey, decodedData)
	if err != nil {
		return nil, err
	}

	var parsedSettings Settings
	if err := json.Unmarshal(decryptedData, &parsedSettings); err != nil {
		return nil, err
	}
	return &parsedSettings, nil
}

// service method to update current state of settings
func (s *Service) UpdateSettings(settings Settings) error {
	session, err := s.sessionProvider.RequireSession()
	if err != nil {
		return err
	}

	data, err := json.Marshal(settings)
	if err != nil {
		return err
	}

	// encrypt the data before storing it in the keyring
	encryptedData, err := utils.EncryptData(session.MasterKey, data)
	if err != nil {
		return err
	}

	encodedData := base64.StdEncoding.EncodeToString(encryptedData)

	return keyring.Set("ayo", session.Username, encodedData)
}
