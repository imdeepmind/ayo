package upload

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"ayo/internal/shared/errors"
)

// Repository abstracts persistence for stored files and their shards. Keeping
// it behind an interface makes the service testable with a fake instead of a
// real SQLite database.
type Repository interface {
	// CreateUpload inserts a stored-file record and returns it populated with
	// its assigned ID and timestamps.
	CreateUpload(
		ctx context.Context,
		jobID int64,
		file string,
		customName string,
		size int64,
		tags []string,
	) (*Upload, error)
	// CreateChunks inserts one row per shard for the given file in a single
	// transaction.
	CreateChunks(ctx context.Context, fileID int64, chunks []ChunkInput) error
}

type repository struct {
	db *sql.DB
}

// NewRepository opens the uploads and chunks tables (creating them if needed)
// and returns a ready-to-use repository.
func NewRepository(db *sql.DB) (Repository, error) {
	if err := initializeTable(db); err != nil {
		return nil, errors.NewInternalServerError("initialize uploads tables", err)
	}
	return &repository{db: db}, nil
}

// initializeTable idempotently ensures the uploads and chunks tables exist.
// chunks.file_id references uploads.id (enforced via the foreign_keys pragma),
// and chunks.chunk_id is globally unique so shard names can never collide even
// across users or uploads.
func initializeTable(db *sql.DB) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS uploads (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			job_id      INTEGER NOT NULL UNIQUE,
			file        TEXT NOT NULL,
			custom_name TEXT NOT NULL DEFAULT '',
			size        INTEGER NOT NULL,
			tags        TEXT NOT NULL DEFAULT '[]',
			storage_id  INTEGER NOT NULL DEFAULT 0,
			created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS chunks (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			file_id     INTEGER NOT NULL,
			shard_index INTEGER NOT NULL,
			chunk_id    TEXT NOT NULL UNIQUE,
			storage_id  INTEGER NOT NULL DEFAULT 0,
			created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (file_id) REFERENCES uploads(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON chunks(file_id)`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			return err
		}
	}
	return nil
}

// CreateUpload inserts a stored-file record and returns it populated with its
// assigned ID and database-set timestamps. It is idempotent per job: if a
// previous run already stored this job (e.g. after an app crash between the
// insert and the job's completion update), the existing row is returned instead
// of failing on the job_id UNIQUE constraint.
func (r *repository) CreateUpload(
	ctx context.Context,
	jobID int64,
	file string,
	customName string,
	size int64,
	tags []string,
) (*Upload, error) {
	encodedTags, err := json.Marshal(tags)
	if err != nil {
		return nil, fmt.Errorf("failed to encode tags: %w", err)
	}

	query := `INSERT OR IGNORE INTO uploads (job_id, file, custom_name, size, tags)
		VALUES (?, ?, ?, ?, ?)`

	result, err := r.db.ExecContext(ctx, query, jobID, file, customName, size, string(encodedTags))
	if err != nil {
		return nil, fmt.Errorf("failed to create upload: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert id: %w", err)
	}
	if id == 0 {
		return r.getUploadByJob(ctx, jobID)
	}

	return r.getUpload(ctx, id)
}

// getUpload fetches one upload row by ID.
func (r *repository) getUpload(ctx context.Context, id int64) (*Upload, error) {
	query := `SELECT id, job_id, file, custom_name, size, tags, storage_id,
		created_at, updated_at FROM uploads WHERE id = ?`

	var upload Upload
	var tags string
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&upload.ID,
		&upload.JobID,
		&upload.File,
		&upload.CustomName,
		&upload.Size,
		&tags,
		&upload.StorageID,
		&upload.CreatedAt,
		&upload.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get upload: %w", err)
	}
	upload.Tags = decodeTags(tags)
	return &upload, nil
}

// getUploadByJob fetches one upload row by its job ID, used to reuse an
// existing record when a job is reprocessed after a crash.
func (r *repository) getUploadByJob(ctx context.Context, jobID int64) (*Upload, error) {
	query := `SELECT id, job_id, file, custom_name, size, tags, storage_id,
		created_at, updated_at FROM uploads WHERE job_id = ?`

	var upload Upload
	var tags string
	err := r.db.QueryRowContext(ctx, query, jobID).Scan(
		&upload.ID,
		&upload.JobID,
		&upload.File,
		&upload.CustomName,
		&upload.Size,
		&tags,
		&upload.StorageID,
		&upload.CreatedAt,
		&upload.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get upload by job: %w", err)
	}
	upload.Tags = decodeTags(tags)
	return &upload, nil
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

// CreateChunks inserts one row per shard for the given file in a single
// transaction, so a partial failure leaves no dangling chunk rows.
func (r *repository) CreateChunks(ctx context.Context, fileID int64, chunks []ChunkInput) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin chunk insert: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	query := `INSERT INTO chunks (file_id, shard_index, chunk_id, storage_id)
		VALUES (?, ?, ?, ?)`

	for _, chunk := range chunks {
		if _, err := tx.ExecContext(ctx, query, fileID, chunk.ShardIndex, chunk.ChunkID, chunk.StorageID); err != nil {
			return fmt.Errorf("failed to create chunk: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit chunks: %w", err)
	}
	return nil
}
