package upload

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"ayo/internal/features/auth"
	"ayo/internal/features/settings"
	"ayo/internal/platform/queue"
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
// both enqueueing (Service) and the processor's needs (Get, GetIncompleteByType,
// UpdateStatusAndProgress).
type QueueService interface {
	Add(input queue.AddInput) (*queue.Job, error)
	GetAll() ([]*queue.Job, error)
	Get(id int64) (*queue.Job, error)
	GetIncompleteByType(jobType string) ([]*queue.Job, error)
	UpdateStatusAndProgress(id int64, status string, progress int) error
}

// UploadRepository is the subset of upload.Repository the processor uses to
// persist stored files and their shards after processing succeeds.
type UploadRepository interface {
	CreateUpload(
		ctx context.Context,
		jobID int64,
		file string,
		customName string,
		size int64,
		tags []string,
		manifest shardManifest,
	) (*Upload, error)
	CreateChunks(ctx context.Context, fileID int64, chunks []ChunkInput) error
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
	validate         *validator.Validate
}

func NewService(sessionProvider SessionProvider, settingsProvider SettingsProvider,
	queueService QueueService, repo Repository) *Service {
	return &Service{
		sessionProvider:  sessionProvider,
		settingsProvider: settingsProvider,
		queueService:     queueService,
		repo:             repo,
		processor:        NewProcessor(sessionProvider, settingsProvider, queueService, repo),
		validate:         validator.New(),
	}
}

// Startup is called by Wails on application startup. It stores the application
// context so native dialogs can be shown, and starts the background processor
// that consumes queued jobs.
func (s *Service) Startup(ctx context.Context) {
	s.ctx = ctx
	s.processor.Start()
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
		info, err := os.Stat(path)
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

// GetPendingJobs returns the jobs still awaiting or in progress (pending and
// processing), oldest first, so the frontend can render their upload progress.
func (s *Service) GetPendingJobs() ([]EnqueuedJob, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return nil, err
	}

	jobs, err := s.queueService.GetAll()
	if err != nil {
		return nil, err
	}

	pending := make([]EnqueuedJob, 0, len(jobs))
	for _, job := range jobs {
		if job.Status != queue.StatusPending && job.Status != queue.StatusProcessing {
			continue
		}
		pending = append(pending, EnqueuedJob{
			ID:         job.ID,
			File:       job.File,
			CustomName: job.CustomName,
			Size:       job.Size,
			Status:     job.Status,
			Progress:   job.Progress,
			Tags:       job.Tags,
		})
	}
	return pending, nil
}

// GetStoredFiles returns every persisted upload (the drive listing), newest
// first.
func (s *Service) GetStoredFiles() ([]StoredFile, error) {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return nil, err
	}

	uploads, err := s.repo.GetAll(context.Background())
	if err != nil {
		return nil, errors.AsInternalServerError("get stored files: list", err)
	}

	stored := make([]StoredFile, 0, len(uploads))
	for _, u := range uploads {
		name := u.CustomName
		if name == "" {
			name = u.File
		}
		stored = append(stored, StoredFile{
			ID:        u.ID,
			Name:      name,
			Size:      u.Size,
			Tags:      u.Tags,
			CreatedAt: u.CreatedAt.UTC().Format(time.RFC3339),
		})
	}
	return stored, nil
}

// DeleteStoredFile removes a persisted upload: its uploads row (and chunk rows
// via the foreign-key cascade), plus the shard folder and encrypted blob on
// disk. On-disk cleanup is best-effort; the database row is the source of
// truth, so a leftover file is logged rather than failing the delete.
func (s *Service) DeleteStoredFile(id int64) error {
	if _, err := s.sessionProvider.RequireSession(); err != nil {
		return err
	}

	upload, err := s.repo.GetUpload(context.Background(), id)
	if err != nil {
		return errors.AsInternalServerError("delete stored file: get", err)
	}

	if err := s.repo.DeleteUpload(context.Background(), id); err != nil {
		return errors.AsInternalServerError("delete stored file: delete", err)
	}

	if err := os.RemoveAll(filepath.Join(chunksDir, fmt.Sprintf("job_%d", upload.JobID))); err != nil {
		slog.Error("delete stored file: remove shards", "error", err)
	}
	if err := os.Remove(filepath.Join(encryptedDir, fmt.Sprintf("%d.enc", upload.JobID))); err != nil {
		slog.Error("delete stored file: remove encrypted blob", "error", err)
	}
	return nil
}
