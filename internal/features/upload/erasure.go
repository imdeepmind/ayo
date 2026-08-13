package upload

import (
	"errors"
	"fmt"
	"io"

	"ayo/internal/clients/storage"
	"ayo/internal/features/settings"

	"github.com/klauspost/reedsolomon"
)

const (
	// blockShardSize caps the per-block shard slice written by encodeBlocks, so
	// per-block memory stays bounded at dataShards * blockShardSize bytes. The
	// actual per-job shard size is computed dynamically (see chunk) and clamped
	// to [minShardSize, blockShardSize] so chunks stay small for small files.
	blockShardSize = 1 << 20 // 1 MiB

	// defaultDataShards is used when erasure coding is disabled (0 parity)
	// or the stored config is unrecognized.
	defaultDataShards = 6

	// minShardSize is the smallest shard the dynamic shard planner targets. It
	// caps how many shards a file is split into; tiny files still honor the
	// config's minimum shard count even if that yields smaller shards.
	minShardSize = 1 << 10 // 1 KiB

	// maxShardSize caps how large a single shard can grow before the planner
	// adds more shards. It bounds the chunk count for large files.
	maxShardSize = 4 << 20 // 4 MiB

	// dynamicThreshold is the shard size above which a file stops using the
	// config's minimum shard count and starts scaling the shard count up. It is
	// also the raw file-size trigger for the erasure-disabled case.
	dynamicThreshold = 16 << 10 // 16 KiB
)

// shardConfig is the erasure-coding layout for one job.
type shardConfig struct {
	dataShards   int
	parityShards int
	blockSize    int
}

// totalShards returns the number of shards (data + parity) per block.
func (c shardConfig) totalShards() int {
	return c.dataShards + c.parityShards
}

// baseShardLayout maps the user's erasure-coding settings to the base (data,
// parity) layout. Erasure coding disabled yields only data shards (no parity);
// an unrecognized config while enabled falls back to a sensible default rather
// than failing the job.
func baseShardLayout(erasure bool, config settings.ErasureCodingMode) (data, parity int) {
	if !erasure {
		return defaultDataShards, 0
	}

	switch config {
	case settings.EC22:
		return 2, 2
	case settings.EC63:
		return 6, 3
	case settings.EC104:
		return 10, 4
	case settings.EC173:
		return 17, 3
	default:
		return 6, 3
	}
}

// computeShardCount decides how many data and parity shards a file of the given
// size should be split into. The erasure config fixes the parity ratio and the
// minimum shard count; the file size then scales the shard count up through a
// ladder (see targetShardSize) so every shard stays within [minShardSize,
// maxShardSize].
//
// Files are split aggressively even when small so a compromised provider only
// ever holds a small slice of the file: files whose minimum shard count keeps
// every shard at or under dynamicThreshold keep that count, and larger files
// are split further toward 16 KiB shards, capped at 4 MiB so the chunk count
// stays bounded. When erasure coding is disabled, files up to 16 KiB use a
// fixed 4 data shards and larger files use the same ladder with no parity.
func computeShardCount(fileSize int64, erasure bool, config settings.ErasureCodingMode) (data, parity int) {
	if fileSize < 1 {
		fileSize = 1
	}

	baseData, baseParity := baseShardLayout(erasure, config)
	minShards := baseData + baseParity
	if !erasure {
		minShards = 4
	}

	trigger := int64(minShards) * dynamicThreshold
	if !erasure {
		trigger = dynamicThreshold
	}

	total := minShards
	if fileSize > trigger {
		dynamic := ceilDiv(fileSize, targetShardSize(fileSize))
		if dynamic < int64(minShards) {
			dynamic = int64(minShards)
		}
		// Never split a file into more shards than the 1 KiB floor allows.
		if cap := ceilDiv(fileSize, minShardSize); dynamic > cap {
			dynamic = cap
		}
		if dynamic < int64(minShards) {
			dynamic = int64(minShards)
		}
		total = int(dynamic)
	}

	if !erasure {
		return total, 0
	}

	// Allocate parity keeping the config's data:parity ratio, rounding
	// half-up so e.g. 2+2 stays at ~50%.
	ratioDen := baseData + baseParity
	parity = (total*baseParity + ratioDen/2) / ratioDen
	if parity < 1 {
		parity = 1
	}
	data = total - parity
	if data < 1 {
		data = 1
		parity = total - 1
	}
	return data, parity
}

// targetShardSize returns the laddered per-shard size target for a file of the
// given size. The ladder scales shard size up with file size: medium files are
// split into 16 KiB shards for security granularity, while very large files cap
// at maxShardSize so the total chunk count stays bounded.
func targetShardSize(fileSize int64) int64 {
	switch {
	case fileSize <= 4<<20: // ≤ 4 MiB
		return dynamicThreshold // 16 KiB
	case fileSize <= 16<<20: // ≤ 16 MiB
		return 64 << 10
	case fileSize <= 64<<20: // ≤ 64 MiB
		return 256 << 10
	case fileSize <= 256<<20: // ≤ 256 MiB
		return 1 << 20 // 1 MiB
	default:
		return maxShardSize // 4 MiB
	}
}

// ceilDiv returns the ceiling of a/b for positive integers.
func ceilDiv(a, b int64) int64 {
	return (a + b - 1) / b
}

// shardManifest carries everything needed to reconstruct the encrypted file
// later (the download step): the exact encrypted size to trim Reed-Solomon
// padding, the shard layout, and how many blocks were encoded. It is persisted
// on the uploads table, not written next to the shards.
type shardManifest struct {
	EncryptedSize int64
	DataShards    int
	ParityShards  int
	ShardSize     int
	BlockCount    int
}

// encodeBlocks streams src into the shard writers, block by block. Each block
// is cfg.blockSize data bytes (the final block is zero-padded), split into
// cfg.dataShards shards with cfg.parityShards encoded, and every shard is
// appended to its corresponding writer (one writer per shard index). onBlock is
// invoked after each block with the number of blocks written so far; a non-nil
// error from it aborts encoding. It returns the total number of blocks written.
func encodeBlocks(enc reedsolomon.Encoder, cfg shardConfig, src io.Reader,
	writers []io.Writer, onBlock func(done int) error) (int, error) {
	block := make([]byte, cfg.blockSize)
	blockCount := 0

	for {
		n, err := io.ReadFull(src, block)
		if errors.Is(err, io.EOF) {
			return blockCount, nil
		}
		if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) {
			return blockCount, err
		}

		// Zero-pad the final partial block so every shard keeps the uniform
		// per-block size reedsolomon requires.
		for i := n; i < len(block); i++ {
			block[i] = 0
		}

		shards, err := enc.Split(block)
		if err != nil {
			return blockCount, err
		}
		if err := enc.Encode(shards); err != nil {
			return blockCount, err
		}
		for i, shard := range shards {
			if _, err := writers[i].Write(shard); err != nil {
				return blockCount, err
			}
		}

		blockCount++
		if onBlock != nil {
			if err := onBlock(blockCount); err != nil {
				return blockCount, err
			}
		}
	}
}

// shardRef pairs a storage client with the object key of one shard, so each
// shard can be read from whichever backend holds it (local filesystem or S3).
type shardRef struct {
	client storage.Client
	key    string
}

// reconstructCiphertext rebuilds the encrypted blob from its shards using the
// stored manifest layout (the download counterpart of chunk()). Each ref maps
// to a chunk row, ordered by shard index. Missing shards are recovered from
// parity via Reconstruct when enough remain.
//
// Because encoding is block-based (each block appends one shard-size slice to
// every shard file), the data shards must be re-interleaved block by block:
// for each block, emit shard 0..D-1's slice for that block, then move to the
// next block. The result is trimmed to the exact encrypted size to remove the
// final block's zero-padding.
//
// The reconstructed data is written to outputWriter as blocks are processed,
// streaming through memory without building the full file in memory. onProgress
// is invoked after each shard is read from its provider with the bytes
// downloaded so far and the total, so the download progress can track the slow
// network I/O.
func reconstructCiphertext(manifest shardManifest, refs []shardRef, outputWriter io.Writer,
	onProgress func(done, total int64) error,
) error {
	total := manifest.DataShards + manifest.ParityShards
	if manifest.DataShards <= 0 || total != len(refs) {
		return fmt.Errorf("invalid layout: expected %d shards, got %d", total, len(refs))
	}

	shards := make([][]byte, total)
	present := 0
	shardSize := int64(manifest.ShardSize) * int64(manifest.BlockCount)
	totalBytes := int64(len(refs)) * shardSize
	var doneBytes int64
	for i, ref := range refs {
		data, err := ref.client.ReadFile(ref.key)
		if err != nil {
			// Missing shard; leave nil so Reconstruct can fill it from parity.
			continue
		}
		shards[i] = data
		present++
		doneBytes += shardSize
		if onProgress != nil {
			if err := onProgress(doneBytes, totalBytes); err != nil {
				return err
			}
		}
	}
	if present < manifest.DataShards {
		return fmt.Errorf("too few shards to reconstruct: %d present, %d needed", present, manifest.DataShards)
	}

	enc, err := reedsolomon.New(manifest.DataShards, manifest.ParityShards,
		reedsolomon.WithAutoGoroutines(manifest.ShardSize))
	if err != nil {
		return fmt.Errorf("create decoder: %w", err)
	}

	if present < total {
		if err := enc.Reconstruct(shards); err != nil {
			return fmt.Errorf("reconstruct shards: %w", err)
		}
	}
	ok, err := enc.Verify(shards)
	if err != nil {
		return fmt.Errorf("verify shards: %w", err)
	}
	if !ok {
		return fmt.Errorf("shard verification failed")
	}

	// Write blocks to output writer, tracking bytes written to trim final padding.
	var bytesWritten int64
	blockData := make([]byte, manifest.DataShards*manifest.ShardSize)
	for b := 0; b < manifest.BlockCount; b++ {
		start := b * manifest.ShardSize
		offset := 0
		for d := 0; d < manifest.DataShards; d++ {
			if len(shards[d]) < start+manifest.ShardSize {
				return fmt.Errorf("shard %d too short for block %d: %d", d, b, len(shards[d]))
			}
			copy(blockData[offset:], shards[d][start:start+manifest.ShardSize])
			offset += manifest.ShardSize
		}

		// Write full block or trimmed final block.
		toWrite := int64(len(blockData))
		if bytesWritten+toWrite > manifest.EncryptedSize {
			toWrite = manifest.EncryptedSize - bytesWritten
		}

		n, err := outputWriter.Write(blockData[:toWrite])
		if err != nil {
			return fmt.Errorf("write block %d: %w", b, err)
		}
		bytesWritten += int64(n)
	}

	if bytesWritten < manifest.EncryptedSize {
		return fmt.Errorf("reconstructed data shorter than expected: %d < %d", bytesWritten, manifest.EncryptedSize)
	}
	return nil
}
