package home

import (
	"context"
	"path/filepath"
	"strings"
	"time"

	"ayo/internal/features/auth"
	"ayo/internal/features/settings"
	"ayo/internal/features/upload"
	"ayo/internal/shared/errors"
)

// SessionProvider is the subset of auth.Service that home depends on.
type SessionProvider interface {
	RequireSession() (*auth.Session, error)
}

// UploadRepository is the subset of the upload repository that home needs to
// build the storage summary and recent-files list. It is implemented by
// upload.NewRepository.
type UploadRepository interface {
	GetAll(ctx context.Context) ([]*upload.Upload, error)
}

// SettingsProvider is the subset of settings.Service that home depends on. It
// supplies the configured storage providers and the erasure-coding layout.
type SettingsProvider interface {
	GetSettings() (*settings.Settings, error)
}

// Service aggregates read-only Home-screen data from the upload repository and
// the signed-in user's settings. It is bound to the frontend via Wails.
type Service struct {
	sessionProvider  SessionProvider
	uploadRepository UploadRepository
	settingsProvider SettingsProvider
}

func NewService(sessionProvider SessionProvider, uploadRepository UploadRepository,
	settingsProvider SettingsProvider) *Service {
	return &Service{
		sessionProvider:  sessionProvider,
		uploadRepository: uploadRepository,
		settingsProvider: settingsProvider,
	}
}

// GetHomeOverview returns the Home-screen summary: the five most recently
// updated files, storage totals and the current erasure-coding setup.
func (s *Service) GetHomeOverview() (*HomeOverview, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return nil, err
	}

	uploads, err := s.uploadRepository.GetAll(context.Background())
	if err != nil {
		return nil, errors.AsInternalServerError("get home overview: list uploads", err)
	}

	overview := &HomeOverview{
		RecentFiles: make([]RecentFile, 0, 5),
		TotalFiles:  len(uploads),
	}

	for _, u := range uploads {
		overview.TotalSizeUsed += u.Size
		overview.ActualSizeUsed += int64(u.ShardSize) * int64(u.DataShards+u.ParityShards) * int64(u.BlockCount)

		if len(overview.RecentFiles) >= 5 {
			continue
		}
		name := u.CustomName
		if name == "" {
			name = u.File
		}
		overview.RecentFiles = append(overview.RecentFiles, RecentFile{
			ID:        u.ID,
			Name:      name,
			Format:    fileFormat(name),
			Size:      u.Size,
			UpdatedAt: u.UpdatedAt.UTC().Format(time.RFC3339),
		})
	}

	userSettings, err := s.settingsProvider.GetSettings()
	if err != nil {
		return nil, errors.AsInternalServerError("get home overview: get settings", err)
	}

	overview.TotalProviders = len(userSettings.CloudKeys)
	if userSettings.ErasureCoding && userSettings.ErasureCodingConfig != "" {
		overview.ErasureCodingSetup = string(userSettings.ErasureCodingConfig)
	} else {
		overview.ErasureCodingSetup = "0+0"
	}

	return overview, nil
}

// fileFormat returns the lowercased file extension without the leading dot,
// falling back to "file" for extensionless names.
func fileFormat(name string) string {
	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(name)), ".")
	if ext == "" {
		return "file"
	}
	return ext
}
