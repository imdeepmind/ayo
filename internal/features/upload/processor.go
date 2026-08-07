package upload

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"path/filepath"
	"sync"

	"ayo/internal/clients/storage"
	"ayo/internal/features/settings"
	"ayo/internal/platform/queue"
	"ayo/internal/shared/crypto"

	"github.com/google/uuid"
	"github.com/klauspost/reedsolomon"
)

const (
	// workerCount is the number of jobs processed concurrently.
	workerCount = 1
	// jobChannelSize is the buffer size of the in-memory job queue. The
	// database is the source of truth, so a job dropped from a full buffer is
	// still picked up on the next resume.
	jobChannelSize = 100
	// encryptedDir is where encrypted files are written. It lives under data/
	// which is gitignored runtime data.
	encryptedDir = "data/encrypted"
	// chunksDir is where Reed-Solomon shards are written, one subfolder per
	// job. Their reconstruction metadata lives on the uploads table, not in the
	// chunk folder.
	chunksDir = "data/chunks"
	// downloadsDir is where reconstructed download jobs are staged until the
	// user picks a final destination via the native save dialog. Files are
	// named by job ID and cleaned up on finalize (or swept at startup).
	downloadsDir = "data/downloads"
)

// Processor consumes queued jobs off a channel and runs the upload/download
// pipeline for each one. It is the worker half of the upload feature: files are
// enqueued via Service and processed asynchronously here, dispatching on each
// job's type.
//
// Upload pipeline (mirrors how settings are encrypted, then splits the
// encrypted file into Reed-Solomon shards):
//
//  1. The entire file is read, encrypted with the session master key via
//     crypto.EncryptData, and the self-contained blob (nonce ‖ ciphertext) is
//     written to data/encrypted/<jobID>.enc.
//  2. The blob is encoded into data + parity shards (the layout comes from the
//     user's erasure-coding settings). Each shard is uploaded to a randomly
//     chosen configured provider (a local folder or an S3 bucket); when no
//     provider is configured it falls back to data/chunks/<jobID>/<uuid>.bin.
//  3. An uploads record (carrying the reconstruction metadata) and one chunks
//     record per shard are persisted, then the job is marked completed.
//
// Download pipeline reverses that: the stored upload's shards are read back in
// order from whichever provider holds them, reconstructed with Reed-Solomon,
// concatenated, trimmed to the stored encrypted size and decrypted, then staged
// under data/downloads/<jobID> until the user picks a destination. The frontend
// triggers that final copy via Service.FinalizeDownload.
type Processor struct {
	sessionProvider  SessionProvider
	settingsProvider SettingsProvider
	queue            QueueService
	uploadRepository UploadRepository
	local            *storage.LocalFilesystem
	jobs             chan int64
	wg               sync.WaitGroup
	resumeOnce       sync.Once
	// queued holds the job IDs that are currently sitting in the channel or
	// being processed. It prevents the same job from being scheduled twice
	// (e.g. when resume() feeds an incomplete job that Submit() is about to
	// push itself), which would otherwise process it a second time and fail to
	// persist its upload row on the UNIQUE job_id constraint.
	queued   map[int64]struct{}
	queuedMu sync.Mutex
}

// NewProcessor wires the session provider, settings provider, queue, upload
// repository and local filesystem client into a ready-to-use Processor. The
// local client backs the app's own runtime files (encrypted staging, downloads)
// and the local/legacy shard paths; S3 clients are created on demand from the
// configured AWS keys. Workers are spawned by Start.
func NewProcessor(sessionProvider SessionProvider, settingsProvider SettingsProvider,
	queue QueueService, uploadRepository UploadRepository, local *storage.LocalFilesystem) *Processor {
	return &Processor{
		sessionProvider:  sessionProvider,
		settingsProvider: settingsProvider,
		queue:            queue,
		uploadRepository: uploadRepository,
		local:            local,
		jobs:             make(chan int64, jobChannelSize),
		queued:           make(map[int64]struct{}),
	}
}

// Start spawns the worker goroutines that process queued jobs. It must be
// called once at application startup. Jobs left over from a previous run are
// not fed here because a session (and thus the master key) is only available
// after login; they are resumed lazily by the first Submit, which happens
// during a logged-in upload.
func (p *Processor) Start() {
	for i := 0; i < workerCount; i++ {
		p.wg.Add(1)
		go p.worker()
	}
}

// Submit queues a job ID for processing. It is non-blocking: jobs dropped from
// a full buffer remain pending in the database and are resumed on the next
// Submit.
func (p *Processor) Submit(id int64) {
	p.resumeOnce.Do(p.resume)
	p.push(id)
}

// push enqueues a job ID onto the channel without blocking. A job that is
// already scheduled (queued or processing) is not scheduled again. If the
// channel buffer is full the job stays pending in the database and the
// reservation is dropped so a later push or the next resume can pick it up.
func (p *Processor) push(id int64) {
	p.queuedMu.Lock()
	if _, ok := p.queued[id]; ok {
		p.queuedMu.Unlock()
		return
	}
	p.queued[id] = struct{}{}
	p.queuedMu.Unlock()

	select {
	case p.jobs <- id:
	default:
		p.queuedMu.Lock()
		delete(p.queued, id)
		p.queuedMu.Unlock()
	}
}

// resume feeds upload and download jobs left over from a previous run into the
// channel so they are processed alongside newly enqueued ones. It runs once,
// on the first Submit, by which point the caller holds a valid session. Other
// job types (e.g. delete) belong to workers that do not exist yet and are left
// untouched.
func (p *Processor) resume() {
	p.resumeType(queue.TypeUpload)
	p.resumeType(queue.TypeDownload)
	p.resumeType(queue.TypeDelete)
}

// resumeType enqueues every incomplete job of the given type, resetting any
// that were mid-flight when the app shut down.
func (p *Processor) resumeType(jobType string) {
	incomplete, err := p.queue.GetIncompleteByType(jobType)
	if err != nil {
		return
	}
	for _, job := range incomplete {
		if job.Status == queue.StatusProcessing {
			// The job was mid-flight when the app shut down. Reset it so it is
			// reprocessed from scratch.
			_ = p.queue.UpdateStatusAndProgress(job.ID, queue.StatusPending, 0)
		}
		p.push(job.ID)
	}
}

// worker processes jobs until the jobs channel is closed. The reservation is
// released once the job finishes so a job is only ever processed once.
func (p *Processor) worker() {
	defer p.wg.Done()
	for id := range p.jobs {
		p.process(id)
		p.queuedMu.Lock()
		delete(p.queued, id)
		p.queuedMu.Unlock()
	}
}

// process runs the pipeline for a single job, dispatching on its type. It is
// the upload counterpart of settings.UpdateSettings: the file is encrypted with
// the session master key and the resulting blob is persisted.
func (p *Processor) process(id int64) {
	job, err := p.queue.Get(id)
	if err != nil {
		return
	}

	switch job.Type {
	case queue.TypeDownload:
		p.processDownload(job)
	case queue.TypeUpload:
		p.processUpload(job)
	case queue.TypeDelete:
		p.processDelete(job)
	default:
		// No worker for this type yet; keep it pending so a future worker can
		// claim it rather than failing it.
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusPending, 0)
	}
}

// processUpload encrypts and chunks one queued file, then persists the uploads
// and chunks records.
func (p *Processor) processUpload(job *queue.Job) {
	id := job.ID
	if err := p.queue.UpdateStatusAndProgress(id, queue.StatusProcessing, 0); err != nil {
		return
	}

	session, err := p.sessionProvider.RequireSession()
	if err != nil {
		// No session means no master key. Keep the job pending rather than
		// failing it; it will be picked up on the next resume.
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusPending, 0)
		return
	}

	plaintext, err := p.local.ReadFile(job.Path)
	if err != nil {
		slog.Error("encrypt file: read", "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 0)
		return
	}

	ciphertext, err := crypto.EncryptData(session.MasterKey, plaintext)
	if err != nil {
		slog.Error("encrypt file: encrypt", "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 0)
		return
	}

	dst := filepath.Join(encryptedDir, fmt.Sprintf("%d.enc", id))
	if err := p.local.WriteFile(dst, ciphertext, 0o600); err != nil {
		slog.Error("encrypt file: write", "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 0)
		return
	}

	s, err := p.settingsProvider.GetSettings()
	if err != nil {
		slog.Error("chunk file: get settings", "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 30)
		return
	}

	shards, manifest, err := p.chunk(id, s, ciphertext)
	if err != nil {
		slog.Error("chunk file", "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 30)
		return
	}

	upload, err := p.uploadRepository.CreateUpload(
		context.Background(),
		id,
		job.File,
		job.CustomName,
		job.Size,
		job.Tags,
		manifest,
	)
	if err != nil {
		slog.Error("persist upload", "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 90)
		return
	}

	if err := p.uploadRepository.CreateChunks(context.Background(), upload.ID, shards); err != nil {
		slog.Error("persist chunks", "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 90)
		return
	}

	_ = p.queue.UpdateStatusAndProgress(id, queue.StatusCompleted, 100)
}

// processDelete removes a stored file and its on-disk chunks. The order
// matches the intent: chunk data (shard folder + encrypted blob) is wiped
// first, then the database rows (uploads + chunks via the FK cascade). The
// delete job's queue record is kept so the operation is persisted, not removed.
func (p *Processor) processDelete(job *queue.Job) {
	id := job.ID
	if err := p.queue.UpdateStatusAndProgress(id, queue.StatusProcessing, 0); err != nil {
		return
	}

	upload, err := p.uploadRepository.GetUpload(context.Background(), job.FileID)
	if err != nil {
		// The stored file is already gone (e.g. a resumed job that was deleted
		// before a crash). Treat it as deleted and complete the job.
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusCompleted, 100)
		return
	}

	_ = p.queue.UpdateStatusAndProgress(id, queue.StatusProcessing, 40)

	// delete all chunks first: every shard file wherever its provider stores
	// it, plus the encrypted blob.
	chunks, err := p.uploadRepository.GetChunks(context.Background(), upload.ID)
	if err != nil {
		slog.Error("delete: get shards", "job", id, "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 40)
		return
	}

	var s *settings.Settings
	if got, err := p.settingsProvider.GetSettings(); err == nil {
		s = got
	}
	legacyDir := filepath.Join(chunksDir, fmt.Sprintf("job_%d", upload.JobID))
	for _, chunk := range chunks {
		client, key, err := storage.ResolveShard(s.CloudKeys, chunk.StorageID, chunk.ChunkID, legacyDir)
		if err != nil {
			slog.Error("delete: resolve shard", "job", id, "chunk", chunk.ChunkID, "error", err)
			continue
		}
		if err := client.Remove(key); err != nil {
			slog.Error("delete: remove shard", "job", id, "chunk", chunk.ChunkID, "error", err)
		}
	}
	if err := p.local.RemoveAll(legacyDir); err != nil {
		slog.Error("delete: clean legacy shard folder", "job", id, "error", err)
	}
	if err := p.local.Remove(filepath.Join(encryptedDir, fmt.Sprintf("%d.enc", upload.JobID))); err != nil {
		slog.Error("delete: remove encrypted blob", "job", id, "error", err)
	}

	_ = p.queue.UpdateStatusAndProgress(id, queue.StatusProcessing, 80)

	// finally delete the database data (chunk rows cascade with the uploads row).
	if err := p.uploadRepository.DeleteUpload(context.Background(), job.FileID); err != nil {
		slog.Error("delete: remove stored file", "job", id, "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 80)
		return
	}

	_ = p.queue.UpdateStatusAndProgress(id, queue.StatusCompleted, 100)
}

// processDownload reconstructs a stored file from its shards, decrypts it and
// stages the plaintext under data/downloads/<jobID> so the user can pick a
// destination. The staged file is finalized (copied + cleaned up) by
// Service.FinalizeDownload.
func (p *Processor) processDownload(job *queue.Job) {
	id := job.ID
	if err := p.queue.UpdateStatusAndProgress(id, queue.StatusProcessing, 0); err != nil {
		return
	}

	session, err := p.sessionProvider.RequireSession()
	if err != nil {
		// No session means no master key. Keep the job pending rather than
		// failing it; it will be picked up on the next resume.
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusPending, 0)
		return
	}

	upload, err := p.uploadRepository.GetUpload(context.Background(), job.FileID)
	if err != nil {
		slog.Error("download: get stored file", "job", id, "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 0)
		return
	}

	chunks, err := p.uploadRepository.GetChunks(context.Background(), upload.ID)
	if err != nil {
		slog.Error("download: get shards", "job", id, "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 10)
		return
	}

	s, err := p.settingsProvider.GetSettings()
	if err != nil {
		slog.Error("download: get settings", "job", id, "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 10)
		return
	}

	legacyDir := filepath.Join(chunksDir, fmt.Sprintf("job_%d", upload.JobID))
	shardRefs := make([]shardRef, 0, len(chunks))
	for _, chunk := range chunks {
		client, key, err := storage.ResolveShard(s.CloudKeys, chunk.StorageID, chunk.ChunkID, legacyDir)
		if err != nil {
			slog.Error("download: resolve shard", "job", id, "chunk", chunk.ChunkID, "error", err)
			_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 10)
			return
		}
		shardRefs = append(shardRefs, shardRef{client: client, key: key})
	}

	ciphertext, err := reconstructCiphertext(shardManifest{
		EncryptedSize: upload.EncryptedSize,
		DataShards:    upload.DataShards,
		ParityShards:  upload.ParityShards,
		ShardSize:     upload.ShardSize,
		BlockCount:    upload.BlockCount,
	}, shardRefs)
	if err != nil {
		slog.Error("download: reconstruct", "job", id, "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 50)
		return
	}

	_ = p.queue.UpdateStatusAndProgress(id, queue.StatusProcessing, 80)

	plaintext, err := crypto.DecryptData(session.MasterKey, ciphertext)
	if err != nil {
		slog.Error("download: decrypt", "job", id, "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 90)
		return
	}

	if err := p.local.WriteFile(filepath.Join(downloadsDir, fmt.Sprintf("%d", id)), plaintext, 0o600); err != nil {
		slog.Error("download: write staging", "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 90)
		return
	}

	_ = p.queue.UpdateStatusAndProgress(id, queue.StatusCompleted, 100)
}

// chunk splits the encrypted file into Reed-Solomon shards, one destination
// per shard. The data/parity shard counts come from the dynamic planner
// (computeShardCount), which scales with the file size so chunks stay within
// [minShardSize, maxShardSize] even for small files. Each shard is opened
// through storage.OpenShardWriter, which randomly picks a configured provider
// and dispatches to that provider's own write function; the provider's ID is
// recorded on the chunk row so the shard can be read back later. When no
// provider is configured (e.g. Ayo mode) shards fall back to
// data/chunks/job_<id>/ with an empty storage ID.
//
// Each shard file is named with a globally unique UUID. It updates job progress
// from 30% (after encryption) up to 90% as blocks are encoded, and returns the
// shard records needed to persist the chunks table along with the
// reconstruction metadata for the uploads table.
func (p *Processor) chunk(id int64, s *settings.Settings, ciphertext []byte) ([]ChunkInput, shardManifest, error) {
	dataShards, parityShards := computeShardCount(int64(len(ciphertext)), s.ErasureCoding, s.ErasureCodingConfig)

	// Size each shard so the data shards carry the whole file (a chunk of
	// ~len(ciphertext)/dataShards bytes), clamped into [minShardSize,
	// blockShardSize] to keep chunks small for small files and per-block memory
	// bounded for large ones.
	shardSize := int(ceilDiv(int64(len(ciphertext)), int64(dataShards)))
	if shardSize < minShardSize {
		shardSize = minShardSize
	}
	if shardSize > blockShardSize {
		shardSize = blockShardSize
	}

	cfg := shardConfig{
		dataShards:   dataShards,
		parityShards: parityShards,
		blockSize:    dataShards * shardSize,
	}

	enc, err := reedsolomon.New(cfg.dataShards, cfg.parityShards, reedsolomon.WithAutoGoroutines(shardSize))
	if err != nil {
		return nil, shardManifest{}, fmt.Errorf("create encoder: %w", err)
	}

	writers := make([]io.Writer, 0, cfg.totalShards())
	closers := make([]io.WriteCloser, 0, cfg.totalShards())
	shards := make([]ChunkInput, 0, cfg.totalShards())
	// Close any writer left open on an early error return (e.g. a local shard
	// file handle). Writers closed successfully below are set to nil so they
	// are never closed twice (an S3 PutObject must only run once).
	defer func() {
		for _, c := range closers {
			if c != nil {
				_ = c.Close()
			}
		}
	}()

	legacyDir := filepath.Join(chunksDir, fmt.Sprintf("job_%d", id))
	for i := 0; i < cfg.totalShards(); i++ {
		chunkID := uuid.NewString() + ".bin"
		w, storageID, err := storage.OpenShardWriter(s.CloudKeys, chunkID, legacyDir)
		if err != nil {
			return nil, shardManifest{}, fmt.Errorf("open shard %d: %w", i, err)
		}
		closers = append(closers, w)
		writers = append(writers, w)
		shards = append(shards, ChunkInput{
			ShardIndex: i,
			ChunkID:    chunkID,
			StorageID:  storageID,
		})
	}

	totalBlocks := (len(ciphertext) + cfg.blockSize - 1) / cfg.blockSize
	if totalBlocks == 0 {
		totalBlocks = 1
	}

	blockCount, err := encodeBlocks(enc, cfg, bytes.NewReader(ciphertext), writers, func(done int) error {
		progress := 30 + 60*done/totalBlocks
		return p.queue.UpdateStatusAndProgress(id, queue.StatusProcessing, progress)
	})
	if err != nil {
		return nil, shardManifest{}, fmt.Errorf("encode blocks: %w", err)
	}

	// Close every shard writer now so provider uploads (e.g. the S3 PutObject)
	// happen while the job can still be marked failed. A close error must fail
	// the job rather than being swallowed by the deferred cleanup.
	for i := range closers {
		if err := closers[i].Close(); err != nil {
			return nil, shardManifest{}, fmt.Errorf("close shard %d: %w", i, err)
		}
		closers[i] = nil
	}

	return shards, shardManifest{
		EncryptedSize: int64(len(ciphertext)),
		DataShards:    cfg.dataShards,
		ParityShards:  cfg.parityShards,
		ShardSize:     shardSize,
		BlockCount:    blockCount,
	}, nil
}
