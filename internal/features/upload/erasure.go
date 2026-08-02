package upload

import (
	"encoding/json"
	"errors"
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

// shardManifest is written next to the shards and carries everything needed to
// reconstruct the encrypted file later (the download step): the exact encrypted
// size to trim Reed-Solomon padding, the shard layout, and how many blocks were
// encoded.
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

// writeShardManifest persists the reconstruction metadata as manifest.json.
func writeShardManifest(path string, m shardManifest) error {
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}
