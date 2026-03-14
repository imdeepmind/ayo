package settings

import (
	"context"
	"encoding/json"

	"ayo/internal/auth"

	"github.com/zalando/go-keyring"
)

type Service struct {
	ctx         context.Context
	authService *auth.Service
}

func NewService(authService *auth.Service) *Service {
	return &Service{
		authService: authService,
	}
}

// Startup is called by Wails on application startup
func (s *Service) Startup(ctx context.Context) {
	s.ctx = ctx
}

// service method to get current state of settings
func (s *Service) GetSettings() (*Settings, error) {
	session, err := s.authService.RequireSession()
	if err != nil {
		return nil, err
	}

	data, err := keyring.Get("ayo", session.Username)
	if err != nil {
		if err == keyring.ErrNotFound {
			return &Settings{}, nil
		}
		return nil, err
	}

	var parsedSettings Settings
	if err := json.Unmarshal([]byte(data), &parsedSettings); err != nil {
		return nil, err
	}
	return &parsedSettings, nil
}

// service method to update current state of settings
func (s *Service) UpdateSettings(settings Settings) error {
	session, err := s.authService.RequireSession()
	if err != nil {
		return err
	}

	data, err := json.Marshal(settings)
	if err != nil {
		return err
	}

	return keyring.Set("ayo", session.Username, string(data))
}
