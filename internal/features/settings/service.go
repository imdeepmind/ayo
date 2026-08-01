package settings

import (
	"context"
	"encoding/json"

	"ayo/internal/features/auth"
	"ayo/internal/shared/crypto"
)

// SessionProvider is the subset of auth.Service that settings depends on.
type SessionProvider interface {
	RequireSession() (*auth.Session, error)
}

type Service struct {
	ctx             context.Context
	sessionProvider SessionProvider
	repo            Repository
}

func NewService(sessionProvider SessionProvider, repo Repository) *Service {
	return &Service{
		sessionProvider: sessionProvider,
		repo:            repo,
	}
}

// Startup is called by Wails on application startup
func (s *Service) Startup(ctx context.Context) {
	s.ctx = ctx
}

// GetSettings loads, decrypts and returns the current settings for the signed-in
// user. An empty Settings is returned when nothing has been saved yet.
func (s *Service) GetSettings() (*Settings, error) {
	session, err := s.sessionProvider.RequireSession()
	if err != nil {
		return nil, err
	}

	data, err := s.repo.Load(context.Background(), session.Username)
	if err != nil {
		return nil, err
	}

	if len(data) == 0 {
		return &Settings{}, nil
	}

	decryptedData, err := crypto.DecryptData(session.MasterKey, data)
	if err != nil {
		return nil, err
	}

	var parsedSettings Settings
	if err := json.Unmarshal(decryptedData, &parsedSettings); err != nil {
		return nil, err
	}
	return &parsedSettings, nil
}

// UpdateSettings encrypts and persists the given settings for the signed-in user.
func (s *Service) UpdateSettings(settings Settings) error {
	session, err := s.sessionProvider.RequireSession()
	if err != nil {
		return err
	}

	data, err := json.Marshal(settings)
	if err != nil {
		return err
	}

	encryptedData, err := crypto.EncryptData(session.MasterKey, data)
	if err != nil {
		return err
	}

	return s.repo.Save(context.Background(), session.Username, encryptedData)
}
