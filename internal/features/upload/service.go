package upload

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"

	"ayo/internal/clients/storage"
	"ayo/internal/features/auth"
	"ayo/internal/features/settings"
	"ayo/internal/platform/queue"
	"ayo/internal/shared/dialog"
	"ayo/internal/shared/errors"

	"github.com/go-playground/validator/v10"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// SessionProvider is the subset of auth.Service that upload depends on.
type SessionProvider interface {
	RequireSession() (*auth.Session, error)
}

// SettingsProvider is the subset of settings.Service that upload depends on. It
// supplies the erasure-coding layout used by the processor when chunking files.
type SettingsProvider interface {
	GetSettings() (*settings.Settings, error)
}

// QueueService is the subset of queue.Service that upload depends on. It covers
// both enqueueing (Service) and the processor's needs (Get, GetActive,
// GetIncompleteByType, UpdateStatusAndProgress).
type QueueService interface {
	Add(input queue.AddInput) (*queue.Job, error)
	GetActive() ([]*queue.Job, error)
	Get(id int64) (*queue.Job, error)
	GetIncompleteByType(jobType string) ([]*queue.Job, error)
	UpdateStatusAndProgress(id int64, status string, progress int) error
}

// UploadRepository is the subset of upload.Repository the processor uses to
// persist stored files and their shards after uploading, and to read them back
// for downloads.
type UploadRepository interface {
	CreateUpload(
		ctx context.Context,
		jobID int64,
		file string,
		customName string,
		size int64,
		tags []string,
		manifest shardManifest,
		fileNonce []byte,
		encryptedFileKey []byte,
		keyNonce []byte,
	) (*Upload, error)
	CreateChunks(ctx context.Context, fileID int64, chunks []ChunkInput) error
	GetUpload(ctx context.Context, id int64) (*Upload, error)
	GetChunks(ctx context.Context, fileID int64) ([]Chunk, error)
	// DeleteUpload removes a stored file by its upload ID; its chunk rows are
	// removed by the chunks → uploads foreign key cascade. Used by the
	// processor when handling a delete job.
	DeleteUpload(ctx context.Context, id int64) error
}

// Service handles the upload flow. It is bound to the frontend via Wails.
//
// On macOS the webview cannot expose absolute file paths for HTML file inputs,
// so file selection happens here through a native dialog
// (runtime.OpenMultipleFilesDialog), and EnqueueFiles turns each selected file
// into one pending job in the queue.
type Service struct {
	ctx              context.Context
	sessionProvider  SessionProvider
	settingsProvider SettingsProvider
	queueService     QueueService
	repo             Repository
	processor        *Processor
	local            *storage.LocalFilesystem
	validate         *validator.Validate
}

func NewService(sessionProvider SessionProvider, settingsProvider SettingsProvider,
	queueService QueueService, repo Repository, local *storage.LocalFilesystem) *Service {
	return &Service{
		sessionProvider:  sessionProvider,
		settingsProvider: settingsProvider,
		queueService:     queueService,
		repo:             repo,
		local:            local,
		processor:        NewProcessor(sessionProvider, settingsProvider, queueService, repo, local),
		validate:         validator.New(),
	}
}

// Startup is called by Wails on application startup. It stores the application
// context so native dialogs can be shown, clears stale download staging from a
// previous run, and starts the background processor that consumes queued jobs.
func (s *Service) Startup(ctx context.Context) {
	s.ctx = ctx
	s.cleanupStaleDownloads()
	s.processor.Start()
}

// cleanupStaleDownloads removes leftover staging files and temp encrypted files
// from a previous run. Downloads are ephemeral: anything still present at
// startup (completed but never saved, or mid-flight) is discarded, since the
// staged bytes are not a persisted record and the user can simply download
// again.
//
// The queue records for those downloads are kept: job history is never pruned.
func (s *Service) cleanupStaleDownloads() {
	// Clean up download staging directory.
	if err := s.local.RemoveAll(downloadsDir); err != nil {
		slog.Error("startup: clear downloads staging", "error", err)
	}
	if err := s.local.MkdirAll(downloadsDir, 0o700); err != nil {
		slog.Error("startup: create downloads staging", "error", err)
	}

	// Clean up temp encrypted files from downloads (download_*.enc pattern).
	// These are intermediate files created during download reconstruction.
	files, err := filepath.Glob(filepath.Join(encryptedDir, "download_*.enc"))
	if err != nil {
		slog.Error("startup: glob download temp files", "error", err)
	} else {
		for _, file := range files {
			if err := s.local.Remove(file); err != nil {
				slog.Error("startup: remove download temp file", "file", file, "error", err)
			}
		}
	}
}

// PickFiles opens a native dialog for selecting one or more files and returns
// their names, absolute paths and sizes. An empty slice (no error) means the
// user cancelled the dialog.
func (s *Service) PickFiles() ([]PickedFile, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return nil, err
	}

	paths, err := runtime.OpenMultipleFilesDialog(s.ctx, runtime.OpenDialogOptions{
		Title: "Select Files to Upload",
	})
	if err != nil {
		return nil, errors.AsInternalServerError("pick files: open dialog", err)
	}

	picked := make([]PickedFile, 0, len(paths))
	for _, path := range paths {
		info, err := s.local.Stat(path)
		if err != nil {
			continue
		}
		picked = append(picked, PickedFile{
			Name: info.Name(),
			Path: path,
			Size: info.Size(),
		})
	}
	return picked, nil
}

// EnqueueFiles creates one pending queue entry per file and returns the created
// jobs.
func (s *Service) EnqueueFiles(input EnqueueFilesInput) ([]EnqueuedJob, error) {
	if err := s.validate.Struct(input); err != nil {
		return nil, errors.ErrInvalidInput
	}

	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return nil, err
	}

	// Uploads require at least one configured storage provider to hold shards.
	settings, err := s.settingsProvider.GetSettings()
	if err != nil {
		return nil, errors.AsInternalServerError("enqueue files: get settings", err)
	}
	if len(settings.CloudKeys) == 0 {
		return nil, errors.ErrNoStorageProvider
	}

	jobs := make([]EnqueuedJob, 0, len(input.Files))
	for _, file := range input.Files {
		customName := file.CustomName
		if customName == "" {
			customName = file.Name
		}
		job, err := s.queueService.Add(queue.AddInput{
			Type:       queue.TypeUpload,
			File:       file.Name,
			CustomName: customName,
			Path:       file.Path,
			Size:       file.Size,
			Tags:       file.Tags,
		})
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, EnqueuedJob{
			ID:         job.ID,
			Type:       job.Type,
			File:       job.File,
			CustomName: job.CustomName,
			Size:       job.Size,
			Status:     job.Status,
			Progress:   job.Progress,
			Tags:       job.Tags,
		})
		s.processor.Submit(job.ID)
	}
	return jobs, nil
}

// GetActiveTransfers returns the jobs currently in flight (pending or
// processing, of any type), oldest first, so the frontend can render progress.
// Finished jobs stay in the queue as audit history and are not returned here.
func (s *Service) GetActiveTransfers() ([]EnqueuedJob, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return nil, err
	}

	jobs, err := s.queueService.GetActive()
	if err != nil {
		return nil, err
	}

	active := make([]EnqueuedJob, 0, len(jobs))
	for _, job := range jobs {
		active = append(active, toEnqueuedJob(job))
	}
	return active, nil
}

// GetJobStatus returns the current persisted state of one queued job, oldest
// audit lookup used to resolve a job's final outcome after it leaves the active
// set. Returns ErrJobNotFound when no such job exists.
func (s *Service) GetJobStatus(id int64) (EnqueuedJob, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return EnqueuedJob{}, err
	}

	job, err := s.queueService.Get(id)
	if err != nil {
		return EnqueuedJob{}, err
	}
	return toEnqueuedJob(job), nil
}

// toEnqueuedJob maps a queue.Job to the flat frontend-facing shape.
func toEnqueuedJob(job *queue.Job) EnqueuedJob {
	return EnqueuedJob{
		ID:         job.ID,
		Type:       job.Type,
		File:       job.File,
		CustomName: job.CustomName,
		Size:       job.Size,
		Status:     job.Status,
		Progress:   job.Progress,
		Tags:       job.Tags,
	}
}

// EnqueueDownload queues a background download of the stored file with the
// given upload ID and returns immediately. The file is reconstructed and staged
// by the processor; FinalizeDownload shows the save dialog once it is ready.
func (s *Service) EnqueueDownload(storageID int64) (EnqueuedJob, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return EnqueuedJob{}, err
	}

	upload, err := s.repo.GetUpload(context.Background(), storageID)
	if err != nil {
		slog.Error("download: get stored file", "storageID", storageID, "error", err)
		return EnqueuedJob{}, errors.AsInternalServerError("download: get stored file", err)
	}

	name := upload.CustomName
	if name == "" {
		name = upload.File
	}

	job, err := s.queueService.Add(queue.AddInput{
		Type:       queue.TypeDownload,
		FileID:     storageID,
		File:       upload.File,
		CustomName: name,
		Size:       upload.Size,
	})
	if err != nil {
		slog.Error("download: enqueue", "storageID", storageID, "error", err)
		return EnqueuedJob{}, err
	}
	s.processor.Submit(job.ID)
	return toEnqueuedJob(job), nil
}

// FinalizeDownload shows the native save dialog for a completed download and,
// on confirmation, copies the staged plaintext to the chosen location. The
// staging file is removed either way; the transient download job's queue record
// is kept for history. It returns the saved path, or "" (nil error) when the
// user cancels.
func (s *Service) FinalizeDownload(jobID int64) (string, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return "", err
	}

	job, err := s.queueService.Get(jobID)
	if err != nil {
		return "", err
	}
	if job.Type != queue.TypeDownload {
		return "", errors.ErrInvalidInput
	}

	staged := filepath.Join(downloadsDir, fmt.Sprintf("%d", jobID))
	if _, err := s.local.Stat(staged); err != nil {
		return "", errors.NewInternalServerError("download: staged file missing", err)
	}

	name := job.CustomName
	if name == "" {
		name = job.File
	}

	dest, err := dialog.SaveFile(s.ctx, dialog.Options{
		DefaultFilename: name,
		Title:           "Save Downloaded File",
	})
	if err != nil {
		return "", errors.AsInternalServerError("download: save dialog", err)
	}

	// The staging file is discarded whether the user saves or cancels. The
	// job's queue record is kept.
	defer func() {
		_ = s.local.Remove(staged)
	}()

	if dest == "" {
		return "", nil
	}

	data, err := s.local.ReadFile(staged)
	if err != nil {
		return "", errors.AsInternalServerError("download: read staging", err)
	}
	if err := s.local.WriteFile(dest, data, 0o600); err != nil {
		return "", errors.AsInternalServerError("download: write destination", err)
	}
	return dest, nil
}

// EnqueueDelete queues a background delete of the stored file with the given
// upload ID and returns immediately. The processor wipes the file's on-disk
// chunks and then removes its database rows; the delete job's queue record is
// kept once it completes.
func (s *Service) EnqueueDelete(storageID int64) (EnqueuedJob, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return EnqueuedJob{}, err
	}

	upload, err := s.repo.GetUpload(context.Background(), storageID)
	if err != nil {
		slog.Error("delete: get stored file", "storageID", storageID, "error", err)
		return EnqueuedJob{}, errors.AsInternalServerError("delete: get stored file", err)
	}

	name := upload.CustomName
	if name == "" {
		name = upload.File
	}

	job, err := s.queueService.Add(queue.AddInput{
		Type:       queue.TypeDelete,
		FileID:     storageID,
		File:       upload.File,
		CustomName: name,
		Size:       upload.Size,
	})
	if err != nil {
		slog.Error("delete: enqueue", "storageID", storageID, "error", err)
		return EnqueuedJob{}, err
	}
	s.processor.Submit(job.ID)
	return toEnqueuedJob(job), nil
}
