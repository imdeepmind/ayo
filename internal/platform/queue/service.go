package queue

import (
	"context"
	stderrors "errors"

	dbclient "ayo/internal/clients/db"
	"ayo/internal/shared/errors"
)

// Service implements the job queue business logic. It wraps the queue
// repository and is the entry point for enqueueing and managing file jobs.
//
// Methods return user-facing sentinel errors from ayo/internal/shared/errors
// rather than wrapped fmt errors; unexpected failures are logged and replaced
// with the vague *errors.InternalServerError.
type Service struct {
	repo Repository
}

// NewService wires the shared connection holder into a ready-to-use queue
// service. The repository resolves the signed-in user's database per operation,
// so the same service serves whichever user is active.
func NewService(conn *dbclient.Connection) *Service {
	return &Service{repo: NewRepository(conn)}
}

// AddInput describes a file to enqueue. File and Path must be present. Type is
// the operation kind (upload/download/delete); when empty it defaults to upload.
// FileID references a stored upload for download/delete jobs; it is ignored for
// uploads.
type AddInput struct {
	Type       string
	FileID     int64
	File       string
	CustomName string
	Path       string
	Size       int64
	Tags       []string
}

// Add enqueues a single pending job (progress 0) and returns the persisted job,
// populated with its assigned ID. One call per job. The required inputs depend
// on the job type: uploads carry a source File and Path, while download/delete
// jobs reference an existing stored upload via FileID.
func (s *Service) Add(input AddInput) (*Job, error) {
	if input.Type == "" {
		input.Type = TypeUpload
	}
	if !isValidJobType(input.Type) {
		return nil, errors.ErrInvalidInput
	}

	switch input.Type {
	case TypeUpload:
		if input.File == "" || input.Path == "" || input.Size < 0 {
			return nil, errors.ErrInvalidInput
		}
	case TypeDownload, TypeDelete:
		if input.FileID <= 0 {
			return nil, errors.ErrInvalidInput
		}
	}

	job, err := s.repo.Add(context.Background(), &Job{
		Type:       input.Type,
		FileID:     input.FileID,
		File:       input.File,
		CustomName: input.CustomName,
		Path:       input.Path,
		Size:       input.Size,
		Status:     StatusPending,
		Progress:   0,
		Tags:       input.Tags,
	})
	if err != nil {
		return nil, errors.AsInternalServerError("add job", err)
	}
	return job, nil
}

// isValidJobType reports whether the given type is one of the supported job
// types.
func isValidJobType(jobType string) bool {
	switch jobType {
	case TypeUpload, TypeDownload, TypeDelete:
		return true
	default:
		return false
	}
}

// Get returns the job with the given ID, or ErrJobNotFound.
func (s *Service) Get(id int64) (*Job, error) {
	job, err := s.repo.Get(context.Background(), id)
	if err != nil {
		if stderrors.Is(err, errors.ErrJobNotFound) {
			return nil, err
		}
		return nil, errors.AsInternalServerError("get job", err)
	}
	return job, nil
}

// GetActive returns the jobs currently in flight (pending or processing),
// oldest first. Finished jobs remain in the table as audit history but are not
// returned here.
func (s *Service) GetActive() ([]*Job, error) {
	jobs, err := s.repo.GetActive(context.Background())
	if err != nil {
		return nil, errors.AsInternalServerError("get active jobs", err)
	}
	return jobs, nil
}

// GetIncompleteByType returns the jobs of the given type still awaiting or in
// progress (pending and processing), oldest first, so a worker can resume work
// after a restart.
func (s *Service) GetIncompleteByType(jobType string) ([]*Job, error) {
	jobs, err := s.repo.GetIncompleteByType(context.Background(), jobType)
	if err != nil {
		return nil, errors.AsInternalServerError("get incomplete jobs", err)
	}
	return jobs, nil
}

// UpdateStatusAndProgress transitions a job to the given status and progress.
// It returns ErrJobNotFound when no such job exists.
func (s *Service) UpdateStatusAndProgress(id int64, status string, progress int) error {
	if err := s.repo.Update(context.Background(), id, status, progress); err != nil {
		if stderrors.Is(err, errors.ErrJobNotFound) {
			return err
		}
		return errors.AsInternalServerError("update job", err)
	}
	return nil
}

// MarkProcessing sets a job to processing with 0% progress.
func (s *Service) MarkProcessing(id int64) error {
	return s.UpdateStatusAndProgress(id, StatusProcessing, 0)
}

// MarkCompleted sets a job to completed with 100% progress.
func (s *Service) MarkCompleted(id int64) error {
	return s.UpdateStatusAndProgress(id, StatusCompleted, 100)
}

// MarkFailed sets a job to failed while keeping its current progress.
func (s *Service) MarkFailed(id int64, progress int) error {
	return s.UpdateStatusAndProgress(id, StatusFailed, progress)
}
