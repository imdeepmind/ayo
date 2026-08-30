package upload

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	dbclient "ayo/internal/clients/db"
)

// Repository abstracts persistence for stored files and their shards. Keeping
// it behind an interface makes the service testable with a fake instead of a
// real SQLite database.
type Repository interface {
	// CreateUpload inserts a stored-file record, including the reconstruction
	// metadata from manifest and the envelope-encryption metadata (the wrapped
	// per-file DEK and its two nonces), and returns it populated with its
	// assigned ID and timestamps.
	CreateUpload(
		ctx context.Context,
		jobID int64,
		file string,
		customName string,
		size int64,
		tags []string,
		manifest shardManifest,
		fileNonce []byte,
		encryptedFileKey []byte,
		keyNonce []byte,
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
	conn *dbclient.Connection
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

// resolve returns the active database client for the current session. The
// schema is guaranteed to be up-to-date before any repository method is
// called, because migrations run inside Connection.SetAndMigrate at login and
// registration time.
func (r *repository) resolve() (*dbclient.Client, error) {
	return r.conn.Current()
}

// CreateUpload inserts a stored-file record and returns it populated with its
// assigned ID and database-set timestamps. It is idempotent per job: if a
// previous run already stored this job (e.g. after an app crash between the
// insert and the job's completion update), the existing row is returned instead
// of failing on the job_id UNIQUE constraint.
//
// fileNonce is the 12-byte base nonce the file payload was encrypted with,
// encryptedFileKey is the per-file DEK sealed by the master key (48 bytes:
// ciphertext ‖ tag) and keyNonce the 12-byte nonce that sealed it. Together
// they let a later download unwrap the DEK and decrypt the payload.
func (r *repository) CreateUpload(
	ctx context.Context,
	jobID int64,
	file string,
	customName string,
	size int64,
	tags []string,
	manifest shardManifest,
	fileNonce []byte,
	encryptedFileKey []byte,
	keyNonce []byte,
) (*Upload, error) {
	encodedTags, err := EncodeTags(tags)
	if err != nil {
		return nil, err
	}

	query := `INSERT OR IGNORE INTO uploads
		(job_id, file, custom_name, size, tags, encrypted_size, data_shards,
		 parity_shards, shard_size, block_count, file_nonce, encrypted_file_key,
		 key_nonce)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}

	if client.IsPostgres() {
		// PostgreSQL has no INSERT OR IGNORE or LastInsertId; use an upsert that
		// does nothing on conflict and return the row ID directly.
		query = `INSERT INTO uploads
			(job_id, file, custom_name, size, tags, encrypted_size, data_shards,
			 parity_shards, shard_size, block_count, file_nonce, encrypted_file_key,
			 key_nonce)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (job_id) DO NOTHING
			RETURNING id`

		var id int64
		err := client.QueryRowContext(ctx, client.Rebind(query), jobID, file, customName, size,
			encodedTags, manifest.EncryptedSize, manifest.DataShards,
			manifest.ParityShards, manifest.ShardSize, manifest.BlockCount,
			fileNonce, encryptedFileKey, keyNonce).Scan(&id)
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
		manifest.ParityShards, manifest.ShardSize, manifest.BlockCount,
		fileNonce, encryptedFileKey, keyNonce)
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
		file_nonce, encrypted_file_key, key_nonce,
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
		&upload.fileNonce,
		&upload.encryptedFileKey,
		&upload.keyNonce,
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
		file_nonce, encrypted_file_key, key_nonce,
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
		&upload.fileNonce,
		&upload.encryptedFileKey,
		&upload.keyNonce,
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

// GetAll returns every stored file, newest first. It is a list/display query,
// so it does not select the envelope-encryption columns (they are only needed
// to decrypt a file, and this query's rows never leave the backend).
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
