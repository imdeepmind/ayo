package queue

import (
	"context"
	"database/sql"
	"fmt"

	"ayo/internal/shared/errors"
)

// Repository abstracts persistence for the job queue. Keeping it behind an
// interface makes the service testable with a fake implementation instead of a
// real SQLite database.
type Repository interface {
	// Add inserts a job and returns it populated with its assigned ID and
	// database-set timestamps.
	Add(ctx context.Context, job *Job) (*Job, error)
	// Get returns the job with the given ID, or ErrJobNotFound when it does not
	// exist.
	Get(ctx context.Context, id int64) (*Job, error)
	// GetAll returns every job, oldest first.
	GetAll(ctx context.Context) ([]*Job, error)
	// Delete removes the job with the given ID. It returns ErrJobNotFound when
	// no such job exists.
	Delete(ctx context.Context, id int64) error
}

type repository struct {
	db *sql.DB
}

// NewRepository opens the queue table (creating it if needed) and returns a
// ready-to-use repository.
func NewRepository(db *sql.DB) (Repository, error) {
	if err := initializeTable(db); err != nil {
		return nil, errors.NewInternalServerError("initialize queue table", err)
	}
	return &repository{db: db}, nil
}

// initializeTable idempotently ensures the queue table exists. Status and
// timestamps are stored as TEXT/DATETIME, and progress as an INTEGER (0-100),
// matching how the queue is exposed to the frontend.
func initializeTable(db *sql.DB) error {
	query := `CREATE TABLE IF NOT EXISTS queue (
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		file       TEXT NOT NULL,
		path       TEXT NOT NULL,
		size       INTEGER NOT NULL,
		status     TEXT NOT NULL,
		progress   INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`

	_, err := db.Exec(query)
	if err != nil {
		return err
	}
	return nil
}

// Add inserts a new job row and returns the job populated with its assigned ID
// and database-set timestamps.
func (r *repository) Add(ctx context.Context, job *Job) (*Job, error) {
	query := `INSERT INTO queue (file, path, size, status, progress)
		VALUES (?, ?, ?, ?, ?)`

	result, err := r.db.ExecContext(ctx, query, job.File, job.Path, job.Size, job.Status, job.Progress)
	if err != nil {
		return nil, fmt.Errorf("failed to add job: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert id: %w", err)
	}

	return r.Get(ctx, id)
}

// Get fetches a job by ID. It returns ErrJobNotFound when no such job exists.
func (r *repository) Get(ctx context.Context, id int64) (*Job, error) {
	query := `SELECT id, file, path, size, status, progress, created_at, updated_at
		FROM queue WHERE id = ?`

	var job Job
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&job.ID,
		&job.File,
		&job.Path,
		&job.Size,
		&job.Status,
		&job.Progress,
		&job.CreatedAt,
		&job.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.ErrJobNotFound
		}
		return nil, fmt.Errorf("failed to get job: %w", err)
	}
	return &job, nil
}

// GetAll returns every job ordered oldest first, which is the natural order
// for processing.
func (r *repository) GetAll(ctx context.Context) ([]*Job, error) {
	query := `SELECT id, file, path, size, status, progress, created_at, updated_at
		FROM queue ORDER BY id ASC`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list jobs: %w", err)
	}
	defer rows.Close()

	jobs := make([]*Job, 0)
	for rows.Next() {
		var job Job
		if err := rows.Scan(
			&job.ID,
			&job.File,
			&job.Path,
			&job.Size,
			&job.Status,
			&job.Progress,
			&job.CreatedAt,
			&job.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan job: %w", err)
		}
		jobs = append(jobs, &job)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate jobs: %w", err)
	}
	return jobs, nil
}

// Delete removes a job by ID. It returns ErrJobNotFound when no such job
// exists.
func (r *repository) Delete(ctx context.Context, id int64) error {
	query := `DELETE FROM queue WHERE id = ?`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete job: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get affected rows: %w", err)
	}
	if affected == 0 {
		return errors.ErrJobNotFound
	}
	return nil
}
