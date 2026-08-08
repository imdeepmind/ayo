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
	// CreateUpload inserts a stored-file record, including the reconstruction
	// metadata from manifest, and returns it populated with its assigned ID and
	// timestamps.
	CreateUpload(
		ctx context.Context,
		jobID int64,
		file string,
		customName string,
		size int64,
		tags []string,
		formatVersion int,
		manifest shardManifest,
	) (*Upload, error)
	// CreateChunks inserts one row per shard for the given file in a single
	// transaction.
	CreateChunks(ctx context.Context, fileID int64, chunks []ChunkInput) error
	// GetChunks returns the shard records for a stored file, ordered by shard
	// index so they can be read back in reconstruction order.
	GetChunks(ctx context.Context, fileID int64) ([]Chunk, error)
	// GetAll returns every stored file, newest first.
	GetAll(ctx context.Context) ([]*Upload, error)
	// GetUpload fetches one stored file by its upload ID.
	GetUpload(ctx context.Context, id int64) (*Upload, error)
	// GetTotalSize returns the sum of all stored file sizes (in bytes).
	GetTotalSize(ctx context.Context) (int64, error)
	// DeleteUpload removes a stored file by its upload ID. Its chunk rows are
	// removed by the chunks → uploads foreign key cascade.
	DeleteUpload(ctx context.Context, id int64) error
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
// chunks.file_id references uploads.id (via the foreign_keys pragma), and
// chunks.chunk_id is globally unique so shard names can never collide even
// across users or uploads. The uploads table also carries the reconstruction
// metadata (encrypted size, shard layout, block count) that a local manifest
// used to hold, so a stored file can always be rebuilt from its row.
//
// Migration: adds format_version column if it doesn't exist (for existing DBs).
func initializeTable(db *sql.DB) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS uploads (
			id             INTEGER PRIMARY KEY AUTOINCREMENT,
			job_id         INTEGER NOT NULL UNIQUE,
			file           TEXT NOT NULL,
			custom_name    TEXT NOT NULL DEFAULT '',
			size           INTEGER NOT NULL,
			tags           TEXT NOT NULL DEFAULT '[]',
			format_version INTEGER NOT NULL DEFAULT 1,
			encrypted_size INTEGER NOT NULL,
			data_shards    INTEGER NOT NULL,
			parity_shards  INTEGER NOT NULL,
			shard_size     INTEGER NOT NULL,
			block_count    INTEGER NOT NULL,
			created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS chunks (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			file_id     INTEGER NOT NULL,
			shard_index INTEGER NOT NULL,
			chunk_id    TEXT NOT NULL UNIQUE,
			storage_id  TEXT NOT NULL DEFAULT '',
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

	// Migration: add format_version column to existing uploads table if missing.
	// Check if the column exists by querying table_info.
	var hasFormatVersion bool
	rows, err := db.Query("PRAGMA table_info(uploads)")
	if err != nil {
		return fmt.Errorf("check format_version column: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name string
		var typ string
		var notNull int
		var dfltValue sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &typ, &notNull, &dfltValue, &pk); err != nil {
			return fmt.Errorf("scan table_info: %w", err)
		}
		if name == "format_version" {
			hasFormatVersion = true
			break
		}
	}

	if !hasFormatVersion {
		// Add format_version column with default value 1 for existing rows.
		if _, err := db.Exec("ALTER TABLE uploads ADD COLUMN format_version INTEGER NOT NULL DEFAULT 1"); err != nil {
			return fmt.Errorf("add format_version column: %w", err)
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
	formatVersion int,
	manifest shardManifest,
) (*Upload, error) {
	encodedTags, err := json.Marshal(tags)
	if err != nil {
		return nil, fmt.Errorf("failed to encode tags: %w", err)
	}

	query := `INSERT OR IGNORE INTO uploads
		(job_id, file, custom_name, size, tags, format_version, encrypted_size, data_shards,
		 parity_shards, shard_size, block_count)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	result, err := r.db.ExecContext(ctx, query, jobID, file, customName, size, string(encodedTags),
		formatVersion, manifest.EncryptedSize, manifest.DataShards, manifest.ParityShards,
		manifest.ShardSize, manifest.BlockCount)
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
	query := `SELECT id, job_id, file, custom_name, size, tags, format_version,
		encrypted_size, data_shards, parity_shards, shard_size, block_count,
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
		&upload.FormatVersion,
		&upload.EncryptedSize,
		&upload.DataShards,
		&upload.ParityShards,
		&upload.ShardSize,
		&upload.BlockCount,
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
	query := `SELECT id, job_id, file, custom_name, size, tags, format_version,
		encrypted_size, data_shards, parity_shards, shard_size, block_count,
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
		&upload.FormatVersion,
		&upload.EncryptedSize,
		&upload.DataShards,
		&upload.ParityShards,
		&upload.ShardSize,
		&upload.BlockCount,
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

// GetAll returns every stored file, newest first.
func (r *repository) GetAll(ctx context.Context) ([]*Upload, error) {
	query := `SELECT id, job_id, file, custom_name, size, tags, format_version,
		encrypted_size, data_shards, parity_shards, shard_size, block_count,
		created_at, updated_at FROM uploads ORDER BY created_at DESC`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list uploads: %w", err)
	}
	defer rows.Close()

	var uploads []*Upload
	for rows.Next() {
		var upload Upload
		var tags string
		if err := rows.Scan(
			&upload.ID,
			&upload.JobID,
			&upload.File,
			&upload.CustomName,
			&upload.Size,
			&tags,
			&upload.FormatVersion,
			&upload.EncryptedSize,
			&upload.DataShards,
			&upload.ParityShards,
			&upload.ShardSize,
			&upload.BlockCount,
			&upload.CreatedAt,
			&upload.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan upload: %w", err)
		}
		upload.Tags = decodeTags(tags)
		uploads = append(uploads, &upload)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate uploads: %w", err)
	}
	return uploads, nil
}

// GetUpload fetches one stored file by its upload ID.
func (r *repository) GetUpload(ctx context.Context, id int64) (*Upload, error) {
	return r.getUpload(ctx, id)
}

// GetTotalSize returns the sum of all stored file sizes in bytes. Files with
// no rows yet (or an empty table) report 0.
func (r *repository) GetTotalSize(ctx context.Context) (int64, error) {
	query := `SELECT COALESCE(SUM(size), 0) FROM uploads`
	var total int64
	if err := r.db.QueryRowContext(ctx, query).Scan(&total); err != nil {
		return 0, fmt.Errorf("failed to sum upload sizes: %w", err)
	}
	return total, nil
}

// DeleteUpload removes a stored file by its upload ID. Its chunk rows are
// removed by the chunks → uploads foreign key cascade.
func (r *repository) DeleteUpload(ctx context.Context, id int64) error {
	query := `DELETE FROM uploads WHERE id = ?`
	if _, err := r.db.ExecContext(ctx, query, id); err != nil {
		return fmt.Errorf("failed to delete upload: %w", err)
	}
	return nil
}

// GetChunks returns the shard records for a stored file, ordered by shard
// index so they can be read back in reconstruction order.
func (r *repository) GetChunks(ctx context.Context, fileID int64) ([]Chunk, error) {
	query := `SELECT id, file_id, shard_index, chunk_id, storage_id, created_at
		FROM chunks WHERE file_id = ? ORDER BY shard_index ASC`

	rows, err := r.db.QueryContext(ctx, query, fileID)
	if err != nil {
		return nil, fmt.Errorf("failed to list chunks: %w", err)
	}
	defer rows.Close()

	var chunks []Chunk
	for rows.Next() {
		var chunk Chunk
		if err := rows.Scan(
			&chunk.ID,
			&chunk.FileID,
			&chunk.ShardIndex,
			&chunk.ChunkID,
			&chunk.StorageID,
			&chunk.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan chunk: %w", err)
		}
		chunks = append(chunks, chunk)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate chunks: %w", err)
	}
	return chunks, nil
}
