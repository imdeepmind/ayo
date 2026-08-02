package queue

import (
	"context"
	stderrors "errors"

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

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Add enqueues a file as a single pending job (progress 0) and returns the
// persisted job, populated with its assigned ID. One call per file.
func (s *Service) Add(file, path string, size int64) (*Job, error) {
	if file == "" || path == "" || size < 0 {
		return nil, errors.ErrInvalidInput
	}

	job, err := s.repo.Add(context.Background(), &Job{
		File:     file,
		Path:     path,
		Size:     size,
		Status:   StatusPending,
		Progress: 0,
	})
	if err != nil {
		return nil, errors.AsInternalServerError("add job", err)
	}
	return job, nil
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

// GetAll returns every queued job, oldest first.
func (s *Service) GetAll() ([]*Job, error) {
	jobs, err := s.repo.GetAll(context.Background())
	if err != nil {
		return nil, errors.AsInternalServerError("get all jobs", err)
	}
	return jobs, nil
}

// Delete removes the job with the given ID, or ErrJobNotFound.
func (s *Service) Delete(id int64) error {
	if err := s.repo.Delete(context.Background(), id); err != nil {
		if stderrors.Is(err, errors.ErrJobNotFound) {
			return err
		}
		return errors.AsInternalServerError("delete job", err)
	}
	return nil
}
