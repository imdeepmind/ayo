package upload

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"

	dbclient "ayo/internal/clients/db"
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
		manifest shardManifest,
	) (*Upload, error)
	// CreateChunks inserts one row per shard for the given file in a single
	// transaction.
	CreateChunks(ctx context.Context, fileID int64, chunks []ChunkInput) error
	// GetChunks returns the shard records for a stored file, ordered by shard
	// index so they can be read back in reconstruction order.
	GetChunks(ctx context.Context, fileID int64) ([]Chunk, error)
	// GetUpload fetches one stored file by its upload ID.
	GetUpload(ctx context.Context, id int64) (*Upload, error)
	// DeleteUpload removes a stored file by its upload ID. Its chunk rows are
	// removed by the chunks → uploads foreign key cascade.
	DeleteUpload(ctx context.Context, id int64) error
}

type repository struct {
	conn       *dbclient.Connection
	initMu     sync.Mutex
	initClient *dbclient.Client
}

// NewRepository returns a repository bound to the shared connection holder. The
// uploads/chunks tables are created lazily on the active client (see resolve),
// since there is no database connection before a user signs in. It returns the
// concrete type so callers (e.g. main.go) can pass the same instance to
// services that depend on different slices of it (upload.Repository vs
// home.UploadRepository).
func NewRepository(conn *dbclient.Connection) *repository {
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
		if err := InitializeSchema(c); err != nil {
			return nil, err
		}
		r.initClient = c
	}
	return c, nil
}

// InitializeSchema idempotently ensures the uploads and chunks tables exist.
// The upload feature owns the shared schema (it is the writer); the home
// feature bootstraps the same tables through this function so both read and
// write the same storage without duplicating the DDL. chunks.file_id references
// uploads.id (via the foreign_keys pragma on SQLite / a native FK on
// PostgreSQL), and chunks.chunk_id is globally unique so shard names can never
// collide even across users or uploads. The uploads table also carries the
// reconstruction metadata (encrypted size, shard layout, block count) that a
// local manifest used to hold, so a stored file can always be rebuilt from its
// row. The DDL branches on the client's dialect (AUTOINCREMENT vs IDENTITY,
// DATETIME vs TIMESTAMP, BIGINT for size columns).
func InitializeSchema(db *dbclient.Client) error {
	var queries []string

	if db.IsPostgres() {
		queries = []string{
			`CREATE TABLE IF NOT EXISTS uploads (
				id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
				job_id         BIGINT NOT NULL UNIQUE,
				file           TEXT NOT NULL,
				custom_name    TEXT NOT NULL DEFAULT '',
				size           BIGINT NOT NULL,
				tags           TEXT NOT NULL DEFAULT '[]',
				encrypted_size BIGINT NOT NULL,
				data_shards    INTEGER NOT NULL,
				parity_shards  INTEGER NOT NULL,
				shard_size     BIGINT NOT NULL,
				block_count    INTEGER NOT NULL,
				created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE TABLE IF NOT EXISTS chunks (
				id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
				file_id     BIGINT NOT NULL,
				shard_index INTEGER NOT NULL,
				chunk_id    TEXT NOT NULL UNIQUE,
				storage_id  TEXT NOT NULL DEFAULT '',
				created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (file_id) REFERENCES uploads(id) ON DELETE CASCADE
			)`,
			`CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON chunks(file_id)`,
		}
	} else {
		queries = []string{
			`CREATE TABLE IF NOT EXISTS uploads (
				id             INTEGER PRIMARY KEY AUTOINCREMENT,
				job_id         INTEGER NOT NULL UNIQUE,
				file           TEXT NOT NULL,
				custom_name    TEXT NOT NULL DEFAULT '',
				size           INTEGER NOT NULL,
				tags           TEXT NOT NULL DEFAULT '[]',
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
	manifest shardManifest,
) (*Upload, error) {
	encodedTags, err := EncodeTags(tags)
	if err != nil {
		return nil, err
	}

	query := `INSERT OR IGNORE INTO uploads
		(job_id, file, custom_name, size, tags, encrypted_size, data_shards,
		 parity_shards, shard_size, block_count)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}

	if client.IsPostgres() {
		// PostgreSQL has no INSERT OR IGNORE or LastInsertId; use an upsert that
		// does nothing on conflict and return the row ID directly.
		query = `INSERT INTO uploads
			(job_id, file, custom_name, size, tags, encrypted_size, data_shards,
			 parity_shards, shard_size, block_count)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (job_id) DO NOTHING
			RETURNING id`

		var id int64
		err := client.QueryRowContext(ctx, client.Rebind(query), jobID, file, customName, size,
			encodedTags, manifest.EncryptedSize, manifest.DataShards,
			manifest.ParityShards, manifest.ShardSize, manifest.BlockCount).Scan(&id)
		if err == sql.ErrNoRows {
			return r.getUploadByJob(ctx, jobID)
		}
		if err != nil {
			return nil, fmt.Errorf("failed to create upload: %w", err)
		}
		return r.getUpload(ctx, id)
	}

	result, err := client.ExecContext(ctx, client.Rebind(query), jobID, file, customName, size,
		encodedTags, manifest.EncryptedSize, manifest.DataShards,
		manifest.ParityShards, manifest.ShardSize, manifest.BlockCount)
	if err != nil {
		return nil, fmt.Errorf("failed to create upload: %w", err)
	}

	id, err := client.LastInsertID(result)
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
	query := `SELECT id, job_id, file, custom_name, size, tags,
		encrypted_size, data_shards, parity_shards, shard_size, block_count,
		created_at, updated_at FROM uploads WHERE id = ?`

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}

	var upload Upload
	var tags string
	err = client.QueryRowContext(ctx, client.Rebind(query), id).Scan(
		&upload.ID,
		&upload.JobID,
		&upload.File,
		&upload.CustomName,
		&upload.Size,
		&tags,
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
	query := `SELECT id, job_id, file, custom_name, size, tags,
		encrypted_size, data_shards, parity_shards, shard_size, block_count,
		created_at, updated_at FROM uploads WHERE job_id = ?`

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}

	var upload Upload
	var tags string
	err = client.QueryRowContext(ctx, client.Rebind(query), jobID).Scan(
		&upload.ID,
		&upload.JobID,
		&upload.File,
		&upload.CustomName,
		&upload.Size,
		&tags,
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

// EncodeTags serializes a tag list to its JSON column representation.
func EncodeTags(tags []string) (string, error) {
	if tags == nil {
		tags = []string{}
	}
	encoded, err := json.Marshal(tags)
	if err != nil {
		return "", fmt.Errorf("failed to encode tags: %w", err)
	}
	return string(encoded), nil
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
	client, err := r.resolve()
	if err != nil {
		return err
	}

	tx, err := client.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin chunk insert: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	query := `INSERT INTO chunks (file_id, shard_index, chunk_id, storage_id)
		VALUES (?, ?, ?, ?)`

	for _, chunk := range chunks {
		_, err := tx.ExecContext(
			ctx,
			client.Rebind(query),
			fileID, chunk.ShardIndex, chunk.ChunkID, chunk.StorageID,
		)
		if err != nil {
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
	query := `SELECT id, job_id, file, custom_name, size, tags,
		encrypted_size, data_shards, parity_shards, shard_size, block_count,
		created_at, updated_at FROM uploads ORDER BY created_at DESC`

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}

	rows, err := client.QueryContext(ctx, query)
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

// DeleteUpload removes a stored file by its upload ID. Its chunk rows are
// removed by the chunks → uploads foreign key cascade.
func (r *repository) DeleteUpload(ctx context.Context, id int64) error {
	query := `DELETE FROM uploads WHERE id = ?`

	client, err := r.resolve()
	if err != nil {
		return err
	}

	if _, err := client.ExecContext(ctx, client.Rebind(query), id); err != nil {
		return fmt.Errorf("failed to delete upload: %w", err)
	}
	return nil
}

// GetChunks returns the shard records for a stored file, ordered by shard
// index so they can be read back in reconstruction order.
func (r *repository) GetChunks(ctx context.Context, fileID int64) ([]Chunk, error) {
	query := `SELECT id, file_id, shard_index, chunk_id, storage_id, created_at
		FROM chunks WHERE file_id = ? ORDER BY shard_index ASC`

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}

	rows, err := client.QueryContext(ctx, client.Rebind(query), fileID)
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
