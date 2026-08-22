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

// SettingsProvider is the subset of settings.Service that home depends on. It
// supplies the configured storage providers and the erasure-coding layout.
type SettingsProvider interface {
	GetSettings() (*settings.Settings, error)
}

// UploadEnqueuer is the subset of upload.Service that home uses to start
// background download and delete jobs. The upload feature owns the queue and
// processor; home only orchestrates the batch and delegates each id.
type UploadEnqueuer interface {
	EnqueueDownload(storageID int64) (upload.EnqueuedJob, error)
	EnqueueDelete(storageID int64) (upload.EnqueuedJob, error)
}

// Repository is the slice of the shared uploads/chunks persistence that the
// Home screen needs: the dashboard reads, the storage totals and the edit
// write. It is implemented by the home feature's repository, which owns the
// read-side queries and delegates the reads shared with the upload flows
// (GetUpload, GetChunks) to the upload feature's repository, the single owner
// of the uploads/chunks tables.
type Repository interface {
	// ListPaged returns one page of the drive listing, ordered by the given
	// sort column (name|size|date) and direction (asc|desc). A non-empty query
	// filters to files whose file or custom name contains it
	// (case-insensitive); an empty query returns every stored file.
	ListPaged(ctx context.Context, query, sortBy, sortDir string, limit, offset int) ([]*upload.Upload, error)
	// Count returns the number of stored files matching the given query, or the
	// total number of stored files when the query is empty.
	Count(ctx context.Context, query string) (int64, error)
	// GetTotalSize returns the sum of all stored file sizes in bytes.
	GetTotalSize(ctx context.Context) (int64, error)
	// GetActualSizeUsed returns the real bytes physically stored across
	// providers: per file, shard size x data+parity shards x block count.
	GetActualSizeUsed(ctx context.Context) (int64, error)
	// GetRecentFiles returns the most recently uploaded stored files, newest
	// first, bounded by the given limit.
	GetRecentFiles(ctx context.Context, limit int) ([]*upload.Upload, error)
	// GetUpload fetches one stored file by its upload ID.
	GetUpload(ctx context.Context, id int64) (*upload.Upload, error)
	// GetChunks returns the shard records for a stored file, ordered by shard
	// index so the distinct providers holding it can be derived.
	GetChunks(ctx context.Context, fileID int64) ([]upload.Chunk, error)
	// UpdateFile sets the user-facing custom name and tags of a stored file,
	// bumping its updated_at timestamp.
	UpdateFile(ctx context.Context, id int64, name string, tags []string) error
}

// Service aggregates Home-screen data from the shared upload repository and the
// signed-in user's settings. It is bound to the frontend via Wails.
type Service struct {
	sessionProvider  SessionProvider
	repository       Repository
	settingsProvider SettingsProvider
	uploadEnqueuer   UploadEnqueuer
}

func NewService(sessionProvider SessionProvider, repository Repository,
	settingsProvider SettingsProvider, uploadEnqueuer UploadEnqueuer) *Service {
	return &Service{
		sessionProvider:  sessionProvider,
		repository:       repository,
		settingsProvider: settingsProvider,
		uploadEnqueuer:   uploadEnqueuer,
	}
}

// GetHomeOverview returns the Home-screen summary: the five most recently
// uploaded files, storage totals and the current erasure-coding setup. Each
// number is an SQL aggregate over the uploads table rather than a client-side
// scan of every row.
func (s *Service) GetHomeOverview() (*HomeOverview, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return nil, err
	}

	ctx := context.Background()
	totalFiles, err := s.repository.Count(ctx, "")
	if err != nil {
		return nil, errors.AsInternalServerError("get home overview: count files", err)
	}
	totalSize, err := s.repository.GetTotalSize(ctx)
	if err != nil {
		return nil, errors.AsInternalServerError("get home overview: sum sizes", err)
	}
	actualSize, err := s.repository.GetActualSizeUsed(ctx)
	if err != nil {
		return nil, errors.AsInternalServerError("get home overview: sum stored sizes", err)
	}
	recent, err := s.repository.GetRecentFiles(ctx, 5)
	if err != nil {
		return nil, errors.AsInternalServerError("get home overview: list recent files", err)
	}

	recentFiles := make([]RecentFile, 0, len(recent))
	for _, u := range recent {
		name := u.CustomName
		if name == "" {
			name = u.File
		}
		recentFiles = append(recentFiles, RecentFile{
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

	overview := &HomeOverview{
		RecentFiles:        recentFiles,
		TotalFiles:         int(totalFiles),
		TotalSizeUsed:      totalSize,
		ActualSizeUsed:     actualSize,
		TotalProviders:     len(userSettings.CloudKeys),
		ErasureCodingSetup: "0+0",
	}
	if userSettings.ErasureCoding && userSettings.ErasureCodingConfig != "" {
		overview.ErasureCodingSetup = string(userSettings.ErasureCodingConfig)
	}

	return overview, nil
}

// GetStorageUsed returns the total size in bytes of all stored files, used by
// the global status bar.
func (s *Service) GetStorageUsed() (int64, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return 0, err
	}

	total, err := s.repository.GetTotalSize(context.Background())
	if err != nil {
		return 0, errors.AsInternalServerError("get storage used", err)
	}
	return total, nil
}

// defaultPageSize is the page size used when GetStoredFiles is called with an
// invalid value.
const defaultPageSize = 20

// maxPageSize caps the number of rows GetStoredFiles may return per page.
const maxPageSize = 50

// Whitelisted sort columns and directions shared between the service's input
// normalization and the repository's ORDER BY builder.
const (
	sortByName = "name"
	sortBySize = "size"
	sortByDate = "date"
	sortAsc    = "asc"
	sortDesc   = "desc"
)

// normalizeSort coerces a frontend-supplied sort column and direction into one
// of the whitelisted values the repository understands. Unknown columns fall
// back to sortByDate (created_at) and unknown directions to sortDesc, so the
// drive listing always starts out newest-first.
func normalizeSort(sortBy, sortDir string) (string, string) {
	switch strings.ToLower(strings.TrimSpace(sortBy)) {
	case sortByName, sortBySize:
		sortBy = strings.ToLower(sortBy)
	default:
		sortBy = sortByDate
	}
	if strings.ToLower(strings.TrimSpace(sortDir)) == sortAsc {
		return sortBy, sortAsc
	}
	return sortBy, sortDesc
}

// GetStoredFiles returns one page of the drive listing. With an empty query it
// returns every persisted upload (normal mode); with a non-empty query it
// returns only files whose name matches the query (search mode). Rows are
// ordered by sortBy (name|size|date, default date) in sortDir (asc|desc,
// default desc) before the page is sliced. The page is bounded by pageSize
// (clamped to [1, maxPageSize], defaulting to defaultPageSize) and the response
// carries the total matching row count so the frontend can render pagination
// controls.
func (s *Service) GetStoredFiles(query, sortBy, sortDir string, page, pageSize int) (StoredFilePage, error) {
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
	sortBy, sortDir = normalizeSort(sortBy, sortDir)

	uploads, err := s.repository.ListPaged(context.Background(), query, sortBy, sortDir, pageSize, offset)
	if err != nil {
		return StoredFilePage{}, errors.AsInternalServerError("get stored files: list", err)
	}
	total, err := s.repository.Count(context.Background(), query)
	if err != nil {
		return StoredFilePage{}, errors.AsInternalServerError("get stored files: count", err)
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

	upload, err := s.repository.GetUpload(context.Background(), id)
	if err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return nil, errors.ErrJobNotFound
		}
		return nil, errors.AsInternalServerError("get file details: get upload", err)
	}

	chunks, err := s.repository.GetChunks(context.Background(), id)
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

// UpdateFile sets a new custom name and tag list for a stored file. Only the
// user-facing custom name and tags are editable; the original file name and the
// stored shards stay untouched. It returns the refreshed listing shape so
// callers can update in place, though the frontend typically reloads the drive
// listing afterwards.
func (s *Service) UpdateFile(id int64, name string, tags []string) (*StoredFile, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return nil, err
	}

	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.ErrInvalidInput
	}

	if err := s.repository.UpdateFile(context.Background(), id, name, tags); err != nil {
		return nil, errors.AsInternalServerError("update file: persist", err)
	}

	upload, err := s.repository.GetUpload(context.Background(), id)
	if err != nil {
		return nil, errors.AsInternalServerError("update file: get upload", err)
	}
	file := toStoredFile(upload)
	return &file, nil
}

// DownloadFiles queues a background download for each of the given upload IDs
// and returns the created jobs so the frontend can track each one to
// completion. Each id becomes one download job, reconstructed and staged by the
// upload feature's processor; FinalizeDownload shows the save dialog once a job
// completes. A single call is used for both single-file and multi-select
// downloads from the drive listing.
func (s *Service) DownloadFiles(ids []int64) ([]upload.EnqueuedJob, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, errors.ErrInvalidInput
	}

	jobs := make([]upload.EnqueuedJob, 0, len(ids))
	for _, id := range ids {
		job, err := s.uploadEnqueuer.EnqueueDownload(id)
		if err != nil {
			return nil, errors.AsInternalServerError("download files: enqueue", err)
		}
		jobs = append(jobs, job)
	}
	return jobs, nil
}

// DeleteFiles queues a background delete for each of the given upload IDs and
// returns the created jobs so the frontend can track each one to completion.
// Each id becomes one delete job; the upload feature's processor wipes the
// file's on-disk chunks and removes its database rows. A single call is used
// for both single-file and multi-select deletes from the drive listing.
func (s *Service) DeleteFiles(ids []int64) ([]upload.EnqueuedJob, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, errors.ErrInvalidInput
	}

	jobs := make([]upload.EnqueuedJob, 0, len(ids))
	for _, id := range ids {
		job, err := s.uploadEnqueuer.EnqueueDelete(id)
		if err != nil {
			return nil, errors.AsInternalServerError("delete files: enqueue", err)
		}
		jobs = append(jobs, job)
	}
	return jobs, nil
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
	case settings.MinIO:
		return "MinIO"
	case settings.Backblaze:
		return "Backblaze B2"
	case settings.Cloudflare:
		return "Cloudflare R2"
	case settings.Wasabi:
		return "Wasabi"
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
