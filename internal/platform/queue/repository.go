package queue

import (
	"context"
	"database/sql"
	"encoding/json"
	stderrors "errors"
	"fmt"
	"sync"

	dbclient "ayo/internal/clients/db"
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
	// GetActive returns the jobs currently in flight (pending or processing),
	// oldest first. Completed and failed jobs stay in the table as audit
	// history but are never returned here.
	GetActive(ctx context.Context) ([]*Job, error)
	// Update sets the status and progress of the job with the given ID. It
	// returns ErrJobNotFound when no such job exists.
	Update(ctx context.Context, id int64, status string, progress int) error
	// GetIncompleteByType returns every job of the given type that is still
	// pending or processing, oldest first, so work can be resumed after an app
	// restart.
	GetIncompleteByType(ctx context.Context, jobType string) ([]*Job, error)
}

type repository struct {
	conn       *dbclient.Connection
	initMu     sync.Mutex
	initClient *dbclient.Client
}

// NewRepository returns a repository bound to the shared connection holder. The
// queue table is created lazily on the active client (see resolve), since there
// is no database connection before a user signs in.
func NewRepository(conn *dbclient.Connection) Repository {
	return &repository{conn: conn}
}

// resolve returns the active client for the current session, creating the
// feature's tables on it the first time it is seen.
func (r *repository) resolve() (*dbclient.Client, error) {
	c, err := r.conn.Current()
	if err != nil {
		return nil, err
	}
	r.initMu.Lock()
	defer r.initMu.Unlock()
	if r.initClient != c {
		if err := initializeTable(c); err != nil {
			return nil, err
		}
		r.initClient = c
	}
	return c, nil
}

// initializeTable idempotently ensures the queue table exists and has all
// expected columns. Type is the operation kind (upload/download/delete), stored
// as TEXT and constrained to the enum values; status and timestamps are stored
// as TEXT/DATETIME (TIMESTAMP on PostgreSQL), progress as an INTEGER (0-100),
// and tags as a JSON-encoded TEXT array. The id column and timestamp type
// branch on the client's dialect.
func initializeTable(db *dbclient.Client) error {
	idColumn := "id INTEGER PRIMARY KEY AUTOINCREMENT"
	timestampType := "DATETIME"
	if db.IsPostgres() {
		idColumn = "id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY"
		timestampType = "TIMESTAMP"
	}

	query := `CREATE TABLE IF NOT EXISTS queue (
		` + idColumn + `,
		type        TEXT NOT NULL DEFAULT 'upload' CHECK (type IN ('upload', 'download', 'delete')),
		file_id     BIGINT NOT NULL DEFAULT 0,
		file        TEXT NOT NULL,
		custom_name TEXT NOT NULL DEFAULT '',
		path        TEXT NOT NULL,
		size        BIGINT NOT NULL,
		status      TEXT NOT NULL,
		progress    INTEGER NOT NULL DEFAULT 0,
		tags        TEXT NOT NULL DEFAULT '[]',
		created_at  ` + timestampType + ` NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at  ` + timestampType + ` NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`

	if _, err := db.Exec(query); err != nil {
		return err
	}

	// Keep the active-job lookup (status-based) fast as the audit table grows
	// without bound.
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_queue_status ON queue (status)`); err != nil {
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

	query := `INSERT INTO queue (type, file_id, file, custom_name, path, size, status, progress, tags)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`

	args := []any{
		job.Type,
		job.FileID,
		job.File,
		job.CustomName,
		job.Path,
		job.Size,
		job.Status,
		job.Progress,
		string(tags),
	}

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}

	if client.IsPostgres() {
		// PostgreSQL has no LastInsertId; fetch the assigned ID via RETURNING.
		var id int64
		err := client.QueryRowContext(ctx, client.Rebind(query)+" RETURNING id", args...).Scan(&id)
		if err != nil {
			return nil, fmt.Errorf("failed to add job: %w", err)
		}
		return r.Get(ctx, id)
	}

	result, err := client.ExecContext(ctx, client.Rebind(query), args...)
	if err != nil {
		return nil, fmt.Errorf("failed to add job: %w", err)
	}

	id, err := client.LastInsertID(result)
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert id: %w", err)
	}

	return r.Get(ctx, id)
}

// Get fetches a job by ID. It returns ErrJobNotFound when no such job exists.
func (r *repository) Get(ctx context.Context, id int64) (*Job, error) {
	query := `SELECT id, type, file_id, file, custom_name, path, size, status, progress, tags,
		created_at, updated_at FROM queue WHERE id = ?`

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}

	job, err := scanJob(client.QueryRowContext(ctx, client.Rebind(query), id))
	if err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return nil, errors.ErrJobNotFound
		}
		return nil, fmt.Errorf("failed to get job: %w", err)
	}
	return job, nil
}

// GetActive returns the jobs still in flight (pending or processing), oldest
// first. The queue table doubles as an append-only audit log, so finished jobs
// are never deleted; this method simply never reads them.
func (r *repository) GetActive(ctx context.Context) ([]*Job, error) {
	query := `SELECT id, type, file_id, file, custom_name, path, size, status, progress, tags,
		created_at, updated_at FROM queue
		WHERE status IN (?, ?) ORDER BY id ASC`

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}

	rows, err := client.QueryContext(ctx, client.Rebind(query), StatusPending, StatusProcessing)
	if err != nil {
		return nil, fmt.Errorf("failed to list active jobs: %w", err)
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
		&job.Type,
		&job.FileID,
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

	client, err := r.resolve()
	if err != nil {
		return err
	}

	result, err := client.ExecContext(ctx, client.Rebind(query), status, progress, id)
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

// GetIncompleteByType returns the jobs of the given type still awaiting or in
// progress (pending and processing), oldest first, so a worker can resume work
// after a restart.
func (r *repository) GetIncompleteByType(ctx context.Context, jobType string) ([]*Job, error) {
	query := `SELECT id, type, file_id, file, custom_name, path, size, status, progress, tags,
		created_at, updated_at FROM queue
		WHERE type = ? AND status IN (?, ?) ORDER BY id ASC`

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}

	rows, err := client.QueryContext(ctx, client.Rebind(query), jobType, StatusPending, StatusProcessing)
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
