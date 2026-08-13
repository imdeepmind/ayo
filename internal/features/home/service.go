package home

import (
	"context"
	"database/sql"
	stderrors "errors"
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
// build the storage summary, recent-files list and the paginated drive
// listing/search. It is implemented by upload.NewRepository.
type UploadRepository interface {
	// GetAll returns every stored file, newest first.
	GetAll(ctx context.Context) ([]*upload.Upload, error)
	// GetAllPaged returns the stored files for one page of the drive listing,
	// newest first, with the given page size and offset.
	GetAllPaged(ctx context.Context, limit, offset int) ([]*upload.Upload, error)
	// SearchByName returns stored files whose file or custom name contains the
	// given query (case-insensitive), newest first, for one page of results.
	SearchByName(ctx context.Context, query string, limit, offset int) ([]*upload.Upload, error)
	// CountUploads returns the total number of stored files.
	CountUploads(ctx context.Context) (int64, error)
	// CountByName returns the number of stored files whose file or custom name
	// contains the given query (case-insensitive).
	CountByName(ctx context.Context, query string) (int64, error)
	// GetUpload fetches one stored file by its upload ID.
	GetUpload(ctx context.Context, id int64) (*upload.Upload, error)
	// GetChunks returns the shard records for a stored file, ordered by shard
	// index so the distinct providers holding it can be derived.
	GetChunks(ctx context.Context, fileID int64) ([]upload.Chunk, error)
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

// defaultPageSize is the page size used when GetStoredFiles is called with an
// invalid value.
const defaultPageSize = 20

// maxPageSize caps the number of rows GetStoredFiles may return per page.
const maxPageSize = 50

// GetStoredFiles returns one page of the drive listing. With an empty query it
// returns every persisted upload, newest first (normal mode); with a non-empty
// query it returns only files whose name matches the query (search mode). The
// page is bounded by pageSize (clamped to [1, maxPageSize], defaulting to
// defaultPageSize) and the response carries the total matching row count so the
// frontend can render pagination controls.
func (s *Service) GetStoredFiles(query string, page, pageSize int) (StoredFilePage, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return StoredFilePage{}, err
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = defaultPageSize
	}
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}
	offset := (page - 1) * pageSize

	query = strings.TrimSpace(query)
	var (
		uploads []*upload.Upload
		total   int64
		err     error
	)
	if query == "" {
		uploads, err = s.uploadRepository.GetAllPaged(context.Background(), pageSize, offset)
		if err == nil {
			total, err = s.uploadRepository.CountUploads(context.Background())
		}
	} else {
		uploads, err = s.uploadRepository.SearchByName(context.Background(), query, pageSize, offset)
		if err == nil {
			total, err = s.uploadRepository.CountByName(context.Background(), query)
		}
	}
	if err != nil {
		return StoredFilePage{}, errors.AsInternalServerError("get stored files: list", err)
	}

	stored := make([]StoredFile, 0, len(uploads))
	for _, u := range uploads {
		stored = append(stored, toStoredFile(u))
	}
	return StoredFilePage{
		Files:    stored,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// toStoredFile maps a persisted upload to its frontend-facing listing shape,
// preferring the user-facing custom name over the original file name.
func toStoredFile(u *upload.Upload) StoredFile {
	name := u.CustomName
	if name == "" {
		name = u.File
	}
	return StoredFile{
		ID:        u.ID,
		Name:      name,
		Size:      u.Size,
		Tags:      u.Tags,
		CreatedAt: u.CreatedAt.UTC().Format(time.RFC3339),
	}
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

// GetFileDetails returns the full detail view of one stored file: the original
// and custom names, the original/encrypted/stored sizes, tags, the
// erasure-coding layout and the distinct providers that hold its shards.
func (s *Service) GetFileDetails(id int64) (*FileDetails, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return nil, err
	}

	upload, err := s.uploadRepository.GetUpload(context.Background(), id)
	if err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return nil, errors.ErrJobNotFound
		}
		return nil, errors.AsInternalServerError("get file details: get upload", err)
	}

	chunks, err := s.uploadRepository.GetChunks(context.Background(), id)
	if err != nil {
		return nil, errors.AsInternalServerError("get file details: get chunks", err)
	}

	userSettings, err := s.settingsProvider.GetSettings()
	if err != nil {
		return nil, errors.AsInternalServerError("get file details: get settings", err)
	}

	return &FileDetails{
		ID:           upload.ID,
		OriginalName: upload.File,
		CustomName:   upload.CustomName,
		Size:         upload.Size,
		StoredSize:   int64(upload.ShardSize) * int64(upload.DataShards+upload.ParityShards) * int64(upload.BlockCount),
		Tags:         upload.Tags,
		DataShards:   upload.DataShards,
		ParityShards: upload.ParityShards,
		Providers:    distinctProviders(chunks, userSettings.CloudKeys),
		CreatedAt:    upload.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:    upload.UpdatedAt.UTC().Format(time.RFC3339),
	}, nil
}

// distinctProviders resolves the unique provider IDs referenced by a file's
// shards into their frontend-facing details, in shard order. Providers that
// are no longer configured are skipped so the view only lists known backends.
func distinctProviders(chunks []upload.Chunk, keys []settings.CloudKey) []ProviderDetails {
	keyByID := make(map[string]settings.CloudKey, len(keys))
	for _, key := range keys {
		keyByID[key.GetID()] = key
	}

	seen := make(map[string]struct{})
	var providers []ProviderDetails
	for _, chunk := range chunks {
		if chunk.StorageID == "" {
			continue
		}
		if _, ok := seen[chunk.StorageID]; ok {
			continue
		}
		seen[chunk.StorageID] = struct{}{}

		key, ok := keyByID[chunk.StorageID]
		if !ok {
			continue
		}
		providers = append(providers, ProviderDetails{
			ID:       key.GetID(),
			Type:     string(key.GetProvider()),
			Name:     providerLabel(key.GetProvider()),
			Resource: providerResource(key),
		})
	}
	return providers
}

// providerLabel maps a provider type to its user-facing name.
func providerLabel(t settings.Provider) string {
	switch t {
	case settings.AWS:
		return "AWS S3"
	case settings.Azure:
		return "Azure Blob"
	case settings.GCP:
		return "Google Cloud"
	case settings.Local:
		return "Local System"
	default:
		return string(t)
	}
}

// providerResource returns the user-named bucket/container/folder a provider
// maps to, used to tell apart multiple providers of the same type.
func providerResource(key settings.CloudKey) string {
	switch k := key.(type) {
	case *settings.AWSKey:
		return k.Bucket
	case *settings.AzureKey:
		return k.ContainerName
	case *settings.GCPKey:
		return k.Bucket
	case *settings.LocalKey:
		return k.FolderName
	default:
		return ""
	}
}
