package upload

import (
	"errors"
	"fmt"
	"io"
	"os"

	"ayo/internal/features/settings"

	"github.com/klauspost/reedsolomon"
)

const (
	// blockShardSize is the size of one shard within a block. A block carries
	// dataShards * blockShardSize data bytes, so every shard written by
	// encodeBlocks has this uniform size, which keeps shard files trivially
	// readable during reconstruction.
	blockShardSize = 1 << 20 // 1 MiB

	// defaultDataShards is used when erasure coding is disabled (0 parity)
	// or the stored config is unrecognized.
	defaultDataShards = 6
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

// parseShardConfig turns the user's erasure-coding settings into a shard
// layout. When erasure coding is disabled the pipeline stays uniform: only data
// shards are written, no parity.
func parseShardConfig(s *settings.Settings) shardConfig {
	data, parity := defaultDataShards, 0

	switch s.ErasureCodingConfig {
	case settings.EC22:
		data, parity = 2, 2
	case settings.EC63:
		data, parity = 6, 3
	case settings.EC104:
		data, parity = 10, 4
	case settings.EC173:
		data, parity = 17, 3
	default:
		if s.ErasureCoding {
			// Unrecognized config while erasure coding is on: fall back to a
			// sensible default rather than failing the whole job.
			data, parity = 6, 3
		}
	}

	return shardConfig{
		dataShards:   data,
		parityShards: parity,
		blockSize:    data * blockShardSize,
	}
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

// reconstructCiphertext rebuilds the encrypted blob from its shard files using
// the stored manifest layout (the download counterpart of chunk()). Each shard
// path maps to a chunk row, ordered by shard index. Missing shards are
// recovered from parity via Reconstruct when enough remain.
//
// Because encoding is block-based (each block appends one shard-size slice to
// every shard file), the data shards must be re-interleaved block by block:
// for each block, emit shard 0..D-1's slice for that block, then move to the
// next block. The result is trimmed to the exact encrypted size to remove the
// final block's zero-padding.
func reconstructCiphertext(manifest shardManifest, shardPaths []string) ([]byte, error) {
	total := manifest.DataShards + manifest.ParityShards
	if manifest.DataShards <= 0 || total != len(shardPaths) {
		return nil, fmt.Errorf("invalid layout: expected %d shards, got %d", total, len(shardPaths))
	}

	shards := make([][]byte, total)
	present := 0
	for i, path := range shardPaths {
		data, err := os.ReadFile(path)
		if err != nil {
			// Missing shard; leave nil so Reconstruct can fill it from parity.
			continue
		}
		shards[i] = data
		present++
	}
	if present < manifest.DataShards {
		return nil, fmt.Errorf("too few shards to reconstruct: %d present, %d needed", present, manifest.DataShards)
	}

	enc, err := reedsolomon.New(manifest.DataShards, manifest.ParityShards,
		reedsolomon.WithAutoGoroutines(manifest.ShardSize))
	if err != nil {
		return nil, fmt.Errorf("create decoder: %w", err)
	}

	if present < total {
		if err := enc.Reconstruct(shards); err != nil {
			return nil, fmt.Errorf("reconstruct shards: %w", err)
		}
	}
	ok, err := enc.Verify(shards)
	if err != nil {
		return nil, fmt.Errorf("verify shards: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("shard verification failed")
	}

	out := make([]byte, 0, manifest.BlockCount*manifest.DataShards*manifest.ShardSize)
	for b := 0; b < manifest.BlockCount; b++ {
		start := b * manifest.ShardSize
		for d := 0; d < manifest.DataShards; d++ {
			if len(shards[d]) < start+manifest.ShardSize {
				return nil, fmt.Errorf("shard %d too short for block %d: %d", d, b, len(shards[d]))
			}
			out = append(out, shards[d][start:start+manifest.ShardSize]...)
		}
	}
	if int64(len(out)) < manifest.EncryptedSize {
		return nil, fmt.Errorf("reconstructed data shorter than expected: %d < %d", len(out), manifest.EncryptedSize)
	}
	return out[:manifest.EncryptedSize], nil
}
