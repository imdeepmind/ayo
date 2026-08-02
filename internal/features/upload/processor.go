package upload

import (
	"bytes"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sync"

	"ayo/internal/platform/queue"
	"ayo/internal/shared/crypto"

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
	// chunksDir is where Reed-Solomon shards and their manifest are written,
	// one subfolder per job.
	chunksDir = "data/chunks"
)

// Processor consumes queued jobs off a channel and runs the upload pipeline for
// each one. It is the worker half of the upload feature: files are enqueued via
// Service.EnqueueFiles and processed asynchronously here.
//
// The current pipeline mirrors how settings are encrypted, then splits the
// encrypted file into Reed-Solomon shards:
//
//  1. The entire file is read, encrypted with the session master key via
//     crypto.EncryptData, and the self-contained blob (nonce ‖ ciphertext) is
//     written to data/encrypted/<jobID>.enc.
//  2. The blob is encoded into data + parity shards (the layout comes from the
//     user's erasure-coding settings) and written to
//     data/chunks/<jobID>/shard_<n>.bin alongside a manifest.json.
//
// The chunk upload stage will be appended to process in a later step.
type Processor struct {
	sessionProvider  SessionProvider
	settingsProvider SettingsProvider
	queue            QueueService
	jobs             chan int64
	wg               sync.WaitGroup
	resumeOnce       sync.Once
}

// NewProcessor wires the session provider, settings provider and queue into a
// ready-to-use Processor. Workers are spawned by Start.
func NewProcessor(sessionProvider SessionProvider, settingsProvider SettingsProvider, queue QueueService) *Processor {
	return &Processor{
		sessionProvider:  sessionProvider,
		settingsProvider: settingsProvider,
		queue:            queue,
		jobs:             make(chan int64, jobChannelSize),
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

// push enqueues a job ID onto the channel without blocking.
func (p *Processor) push(id int64) {
	select {
	case p.jobs <- id:
	default:
	}
}

// resume feeds jobs left over from a previous run into the channel so they are
// processed alongside newly enqueued ones. It runs once, on the first Submit,
// by which point the caller holds a valid session.
func (p *Processor) resume() {
	incomplete, err := p.queue.GetIncomplete()
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

// worker processes jobs until the jobs channel is closed.
func (p *Processor) worker() {
	defer p.wg.Done()
	for id := range p.jobs {
		p.process(id)
	}
}

// process runs the upload pipeline for a single job. It is the upload
// counterpart of settings.UpdateSettings: the file is encrypted with the
// session master key and the resulting blob is persisted.
func (p *Processor) process(id int64) {
	if err := p.queue.UpdateStatusAndProgress(id, queue.StatusProcessing, 0); err != nil {
		return
	}

	job, err := p.queue.Get(id)
	if err != nil {
		return
	}

	session, err := p.sessionProvider.RequireSession()
	if err != nil {
		// No session means no master key. Keep the job pending rather than
		// failing it; it will be picked up on the next resume.
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusPending, 0)
		return
	}

	plaintext, err := os.ReadFile(job.Path)
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
	if err := os.MkdirAll(encryptedDir, 0o700); err != nil {
		slog.Error("encrypt file: create dir", "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 0)
		return
	}
	if err := os.WriteFile(dst, ciphertext, 0o600); err != nil {
		slog.Error("encrypt file: write", "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 0)
		return
	}

	if err := p.chunk(id, ciphertext); err != nil {
		slog.Error("chunk file", "error", err)
		_ = p.queue.UpdateStatusAndProgress(id, queue.StatusFailed, 30)
		return
	}

	_ = p.queue.UpdateStatusAndProgress(id, queue.StatusCompleted, 100)
}

// chunk splits the encrypted file into Reed-Solomon shards written under
// data/chunks/<jobID>/, using the user's erasure-coding settings. It updates
// job progress from 30% (after encryption) up to 90% as blocks are encoded.
func (p *Processor) chunk(id int64, ciphertext []byte) error {
	s, err := p.settingsProvider.GetSettings()
	if err != nil {
		return fmt.Errorf("get settings: %w", err)
	}
	cfg := parseShardConfig(s)

	dir := filepath.Join(chunksDir, fmt.Sprintf("job_%d", id))
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("create chunk dir: %w", err)
	}

	enc, err := reedsolomon.New(cfg.dataShards, cfg.parityShards, reedsolomon.WithAutoGoroutines(blockShardSize))
	if err != nil {
		return fmt.Errorf("create encoder: %w", err)
	}

	writers := make([]io.Writer, 0, cfg.totalShards())
	files := make([]*os.File, 0, cfg.totalShards())
	defer func() {
		for _, f := range files {
			_ = f.Close()
		}
	}()

	for i := 0; i < cfg.totalShards(); i++ {
		f, err := os.OpenFile(filepath.Join(dir, fmt.Sprintf("shard_%d.bin", i)), os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
		if err != nil {
			return fmt.Errorf("create shard file: %w", err)
		}
		files = append(files, f)
		writers = append(writers, f)
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
		return fmt.Errorf("encode blocks: %w", err)
	}

	return writeShardManifest(filepath.Join(dir, "manifest.json"), shardManifest{
		EncryptedSize: int64(len(ciphertext)),
		DataShards:    cfg.dataShards,
		ParityShards:  cfg.parityShards,
		ShardSize:     blockShardSize,
		BlockCount:    blockCount,
	})
}
