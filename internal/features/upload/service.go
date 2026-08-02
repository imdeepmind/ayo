package upload

import (
	"context"
	"os"

	"ayo/internal/features/auth"
	"ayo/internal/shared/errors"
	"ayo/internal/shared/queue"

	"github.com/go-playground/validator/v10"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// SessionProvider is the subset of auth.Service that upload depends on.
type SessionProvider interface {
	RequireSession() (*auth.Session, error)
}

// QueueService is the subset of queue.Service that upload depends on.
type QueueService interface {
	Add(input queue.AddInput) (*queue.Job, error)
	GetAll() ([]*queue.Job, error)
}

// Service handles the upload flow. It is bound to the frontend via Wails.
//
// On macOS the webview cannot expose absolute file paths for HTML file inputs,
// so file selection happens here through a native dialog
// (runtime.OpenMultipleFilesDialog), and EnqueueFiles turns each selected file
// into one pending job in the queue.
type Service struct {
	ctx             context.Context
	sessionProvider SessionProvider
	queueService    QueueService
	validate        *validator.Validate
}

func NewService(sessionProvider SessionProvider, queueService QueueService) *Service {
	return &Service{
		sessionProvider: sessionProvider,
		queueService:    queueService,
		validate:        validator.New(),
	}
}

// Startup is called by Wails on application startup. It stores the application
// context so native dialogs can be shown.
func (s *Service) Startup(ctx context.Context) {
	s.ctx = ctx
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
