package queue

import (
	"context"
	"database/sql"
	"encoding/json"
	stderrors "errors"
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
	// Update sets the status and progress of the job with the given ID. It
	// returns ErrJobNotFound when no such job exists.
	Update(ctx context.Context, id int64, status string, progress int) error
	// GetIncomplete returns every job that is still pending or processing,
	// oldest first, so work can be resumed after an app restart.
	GetIncomplete(ctx context.Context) ([]*Job, error)
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

// initializeTable idempotently ensures the queue table exists and has all
// expected columns. Status and timestamps are stored as TEXT/DATETIME, progress
// as an INTEGER (0-100), and tags as a JSON-encoded TEXT array.
func initializeTable(db *sql.DB) error {
	query := `CREATE TABLE IF NOT EXISTS queue (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		file        TEXT NOT NULL,
		custom_name TEXT NOT NULL DEFAULT '',
		path        TEXT NOT NULL,
		size        INTEGER NOT NULL,
		status      TEXT NOT NULL,
		progress    INTEGER NOT NULL DEFAULT 0,
		tags        TEXT NOT NULL DEFAULT '[]',
		created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`

	if _, err := db.Exec(query); err != nil {
		return err
	}
	return nil
}

// Add inserts a new job row and returns the job populated with its assigned ID
// and database-set timestamps.
func (r *repository) Add(ctx context.Context, job *Job) (*Job, error) {
	tags, err := json.Marshal(job.Tags)
	if err != nil {
		return nil, fmt.Errorf("failed to encode tags: %w", err)
	}

	query := `INSERT INTO queue (file, custom_name, path, size, status, progress, tags)
		VALUES (?, ?, ?, ?, ?, ?, ?)`

	result, err := r.db.ExecContext(
		ctx,
		query,
		job.File,
		job.CustomName,
		job.Path,
		job.Size,
		job.Status,
		job.Progress,
		string(tags),
	)
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
	query := `SELECT id, file, custom_name, path, size, status, progress, tags,
		created_at, updated_at FROM queue WHERE id = ?`

	job, err := scanJob(r.db.QueryRowContext(ctx, query, id))
	if err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return nil, errors.ErrJobNotFound
		}
		return nil, fmt.Errorf("failed to get job: %w", err)
	}
	return job, nil
}

// GetAll returns every job ordered oldest first, which is the natural order
// for processing.
func (r *repository) GetAll(ctx context.Context) ([]*Job, error) {
	query := `SELECT id, file, custom_name, path, size, status, progress, tags,
		created_at, updated_at FROM queue ORDER BY id ASC`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list jobs: %w", err)
	}
	defer rows.Close()

	jobs := make([]*Job, 0)
	for rows.Next() {
		job, err := scanJob(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan job: %w", err)
		}
		jobs = append(jobs, job)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate jobs: %w", err)
	}
	return jobs, nil
}

// scanJob reads one queue row into a Job, decoding the JSON tags column. It
// works with both single rows (sql.Row) and result sets (sql.Rows).
func scanJob(row interface{ Scan(dest ...any) error }) (*Job, error) {
	var job Job
	var tags string
	err := row.Scan(
		&job.ID,
		&job.File,
		&job.CustomName,
		&job.Path,
		&job.Size,
		&job.Status,
		&job.Progress,
		&tags,
		&job.CreatedAt,
		&job.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	job.Tags = decodeTags(tags)
	return &job, nil
}

// decodeTags parses a JSON-encoded tag list. Malformed or empty values fall
// back to an empty slice.
func decodeTags(data string) []string {
	var tags []string
	if err := json.Unmarshal([]byte(data), &tags); err != nil {
		return []string{}
	}
	if tags == nil {
		return []string{}
	}
	return tags
}

// Update sets the status and progress of a job. It returns ErrJobNotFound when
// no such job exists.
func (r *repository) Update(ctx context.Context, id int64, status string, progress int) error {
	query := `UPDATE queue SET status = ?, progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`

	result, err := r.db.ExecContext(ctx, query, status, progress, id)
	if err != nil {
		return fmt.Errorf("failed to update job: %w", err)
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

// GetIncomplete returns the jobs still awaiting or in progress (pending and
// processing), oldest first, so a worker can resume work after a restart.
func (r *repository) GetIncomplete(ctx context.Context) ([]*Job, error) {
	query := `SELECT id, file, custom_name, path, size, status, progress, tags,
		created_at, updated_at FROM queue
		WHERE status IN (?, ?) ORDER BY id ASC`

	rows, err := r.db.QueryContext(ctx, query, StatusPending, StatusProcessing)
	if err != nil {
		return nil, fmt.Errorf("failed to list incomplete jobs: %w", err)
	}
	defer rows.Close()

	jobs := make([]*Job, 0)
	for rows.Next() {
		job, err := scanJob(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan job: %w", err)
		}
		jobs = append(jobs, job)
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
