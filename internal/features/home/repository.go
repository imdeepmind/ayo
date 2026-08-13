package home

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	dbclient "ayo/internal/clients/db"
	"ayo/internal/features/upload"
)

// repository implements the home feature's slice of the shared uploads/chunks
// persistence: the dashboard reads, the storage totals and the edit write. The
// upload feature owns the schema and the write path (CreateUpload, CreateChunks,
// DeleteUpload); this repository owns the read-side queries and delegates the
// two shared reads (GetUpload, GetChunks) to the upload repository so the data
// layer is implemented exactly once.
type repository struct {
	conn       *dbclient.Connection
	uploadRepo upload.Repository
	initMu     sync.Mutex
	initClient *dbclient.Client
}

// NewRepository returns a repository bound to the shared connection holder and
// the upload feature's repository (used for the reads shared with the upload
// flows). The uploads/chunks tables are created lazily on the active client
// (see resolve), since there is no database connection before a user signs in.
func NewRepository(conn *dbclient.Connection, uploadRepo upload.Repository) *repository {
	return &repository{conn: conn, uploadRepo: uploadRepo}
}

// resolve returns the active client for the current session, ensuring the
// shared uploads/chunks schema exists on it the first time it is seen. The DDL
// lives only in the upload feature; this repository reuses it rather than
// duplicating it.
func (r *repository) resolve() (*dbclient.Client, error) {
	c, err := r.conn.Current()
	if err != nil {
		return nil, err
	}
	r.initMu.Lock()
	defer r.initMu.Unlock()
	if r.initClient != c {
		if err := upload.InitializeSchema(c); err != nil {
			return nil, err
		}
		r.initClient = c
	}
	return c, nil
}

// GetAll returns every stored file, newest first.
func (r *repository) GetAll(ctx context.Context) ([]*upload.Upload, error) {
	query := `SELECT id, job_id, file, custom_name, size, tags, format_version,
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

	var uploads []*upload.Upload
	for rows.Next() {
		var upload upload.Upload
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

// GetAllPaged returns one page of stored files, newest first. The page is
// bounded by the given limit and offset so the drive listing can be paginated.
func (r *repository) GetAllPaged(ctx context.Context, limit, offset int) ([]*upload.Upload, error) {
	query := `SELECT id, job_id, file, custom_name, size, tags, format_version,
		encrypted_size, data_shards, parity_shards, shard_size, block_count,
		created_at, updated_at FROM uploads ORDER BY created_at DESC LIMIT ? OFFSET ?`

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}

	rows, err := client.QueryContext(ctx, client.Rebind(query), limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list uploads: %w", err)
	}
	defer rows.Close()

	var uploads []*upload.Upload
	for rows.Next() {
		var upload upload.Upload
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

// CountUploads returns the total number of stored files.
func (r *repository) CountUploads(ctx context.Context) (int64, error) {
	query := `SELECT COUNT(*) FROM uploads`

	client, err := r.resolve()
	if err != nil {
		return 0, err
	}

	var count int64
	if err := client.QueryRowContext(ctx, query).Scan(&count); err != nil {
		return 0, fmt.Errorf("failed to count uploads: %w", err)
	}
	return count, nil
}

// CountByName returns the number of stored files whose original or custom name
// contains the query (case-insensitive).
func (r *repository) CountByName(ctx context.Context, query string) (int64, error) {
	pattern := "%" + query + "%"
	base := `SELECT COUNT(*) FROM uploads`

	client, err := r.resolve()
	if err != nil {
		return 0, err
	}

	var sql string
	var args []any
	if client.IsPostgres() {
		sql = base + ` WHERE file ILIKE ? OR custom_name ILIKE ?`
		args = []any{pattern, pattern}
	} else {
		sql = base + ` WHERE file LIKE ? OR custom_name LIKE ?`
		args = []any{pattern, pattern}
	}

	var count int64
	if err := client.QueryRowContext(ctx, client.Rebind(sql), args...).Scan(&count); err != nil {
		return 0, fmt.Errorf("failed to count matching uploads: %w", err)
	}
	return count, nil
}

// SearchByName returns stored files whose original or custom name contains the
// query, newest first, for one page of results. SQLite LIKE is
// case-insensitive for ASCII; PostgreSQL requires ILIKE for the same behaviour.
func (r *repository) SearchByName(ctx context.Context, query string, limit, offset int) ([]*upload.Upload, error) {
	pattern := "%" + query + "%"
	base := `SELECT id, job_id, file, custom_name, size, tags, format_version,
		encrypted_size, data_shards, parity_shards, shard_size, block_count,
		created_at, updated_at FROM uploads`

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}

	var sql string
	var args []any
	if client.IsPostgres() {
		sql = base + ` WHERE file ILIKE ? OR custom_name ILIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
		args = []any{pattern, pattern, limit, offset}
	} else {
		sql = base + ` WHERE file LIKE ? OR custom_name LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
		args = []any{pattern, pattern, limit, offset}
	}

	rows, err := client.QueryContext(ctx, client.Rebind(sql), args...)
	if err != nil {
		return nil, fmt.Errorf("failed to search uploads: %w", err)
	}
	defer rows.Close()

	var uploads []*upload.Upload
	for rows.Next() {
		var upload upload.Upload
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

// GetTotalSize returns the sum of all stored file sizes in bytes. Files with
// no rows yet (or an empty table) report 0.
func (r *repository) GetTotalSize(ctx context.Context) (int64, error) {
	query := `SELECT COALESCE(SUM(size), 0) FROM uploads`

	client, err := r.resolve()
	if err != nil {
		return 0, err
	}

	var total int64
	if err := client.QueryRowContext(ctx, query).Scan(&total); err != nil {
		return 0, fmt.Errorf("failed to sum upload sizes: %w", err)
	}
	return total, nil
}

// UpdateFile sets the user-facing custom name and tags of a stored file. The
// original file name and the stored shards are left untouched; updated_at is
// refreshed so the change is reflected in the stored file's timestamps.
func (r *repository) UpdateFile(ctx context.Context, id int64, name string, tags []string) error {
	encodedTags, err := upload.EncodeTags(tags)
	if err != nil {
		return err
	}

	query := `UPDATE uploads SET custom_name = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`

	client, err := r.resolve()
	if err != nil {
		return err
	}

	if _, err := client.ExecContext(ctx, client.Rebind(query), name, encodedTags, id); err != nil {
		return fmt.Errorf("failed to update file: %w", err)
	}
	return nil
}

// GetUpload fetches one stored file by its upload ID. The read is shared with
// the upload feature's download/delete flows, so it is delegated to the upload
// repository (the single owner of the uploads/chunks data layer) instead of
// being re-implemented here.
func (r *repository) GetUpload(ctx context.Context, id int64) (*upload.Upload, error) {
	return r.uploadRepo.GetUpload(ctx, id)
}

// GetChunks returns the shard records for a stored file, ordered by shard
// index so the distinct providers holding it can be derived. Like GetUpload it
// is delegated to the upload repository, which also needs it for downloads.
func (r *repository) GetChunks(ctx context.Context, fileID int64) ([]upload.Chunk, error) {
	return r.uploadRepo.GetChunks(ctx, fileID)
}

// decodeTags parses a JSON-encoded tag list. Malformed or empty values fall
// back to an empty slice. It mirrors the upload feature's helper, which is
// unexported there.
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

// The compile-time assertion pins this repository to the interface the home
// service depends on, so a refactor of the data layer fails loudly here.
var _ Repository = (*repository)(nil)
