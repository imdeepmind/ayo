package storage

import (
	"fmt"
	"io"
	"math/rand/v2"
	"path/filepath"
	"strings"

	"ayo/internal/features/settings"
)

// OpenShardWriter opens a writer for a new shard named chunkID, picking a
// configured provider at random and dispatching to that provider's own write
// path. It returns the open writer and the provider's ID to record on the chunk
// row. Every upload must have at least one configured provider; without one it
// returns an error. The switch is the extension point for future providers
// (Azure, GCP): each adds a case plus its own open<Provider>Shard.
func OpenShardWriter(providers []settings.CloudKey, chunkID string) (io.WriteCloser, string, error) {
	if len(providers) == 0 {
		return nil, "", fmt.Errorf("no storage provider configured")
	}

	key := providers[rand.IntN(len(providers))]
	switch k := key.(type) {
	case *settings.LocalKey:
		w, err := openLocalShard(k, chunkID)
		return w, k.GetID(), err
	case *settings.AWSKey:
		w, err := openS3Shard(k, chunkID)
		return w, k.GetID(), err
	default:
		return nil, "", fmt.Errorf("storage provider %q is not supported yet", key.GetProvider())
	}
}

// ResolveShard resolves the storage client and object key for one chunk row so
// it can be read (download) or removed (delete). It dispatches on the provider
// recorded in the chunk's storage ID. The switch is the extension point for
// future providers (Azure, GCP).
func ResolveShard(providers []settings.CloudKey, storageID, chunkID string) (Client, string, error) {
	if storageID == "" {
		return nil, "", fmt.Errorf("shard %q has no storage provider recorded", chunkID)
	}

	prefix, _, _ := strings.Cut(storageID, "_")
	switch prefix {
	case string(settings.Local):
		folder, ok := folderForID(providers, storageID)
		if !ok {
			return nil, "", fmt.Errorf("local provider %q is no longer configured", storageID)
		}
		return &LocalFilesystem{}, filepath.Join(folder, chunkID), nil
	case string(settings.AWS):
		key, ok := awsKeyForID(providers, storageID)
		if !ok {
			return nil, "", fmt.Errorf("aws provider %q is no longer configured", storageID)
		}
		return newS3(key.Bucket, key.Region, key.AccessKeyID, key.SecretAccessKey), chunkID, nil
	default:
		return nil, "", fmt.Errorf("storage provider %q is not supported yet", prefix)
	}
}

// Validate verifies a configured provider is usable before settings are saved.
// It dispatches to each provider client's own validation (a local folder is
// created, an AWS bucket is pinged) and returns a user-facing error describing
// any failure. The switch is the extension point for future providers (Azure,
// GCP): each adds a case plus a Validate method on its client.
func Validate(key settings.CloudKey) error {
	switch k := key.(type) {
	case *settings.LocalKey:
		return (&LocalFilesystem{}).Validate(k)
	case *settings.AWSKey:
		return newS3(k.Bucket, k.Region, k.AccessKeyID, k.SecretAccessKey).Validate(k)
	default:
		return fmt.Errorf("storage provider %q is not supported yet", key.GetProvider())
	}
}

// openLocalShard opens a new shard file inside the local provider's storage
// root, which is the picked folder plus the folder name (FolderPath/FolderName);
// the root is created automatically by OpenWriter. Shards are stored flat in
// the root (no per-job subfolders); the UUID chunk IDs prevent collisions.
func openLocalShard(key *settings.LocalKey, chunkID string) (io.WriteCloser, error) {
	f, err := (&LocalFilesystem{}).OpenWriter(filepath.Join(key.FolderPath, key.FolderName, chunkID))
	if err != nil {
		return nil, fmt.Errorf("create local shard: %w", err)
	}
	return f, nil
}

// openS3Shard returns a writer that streams the shard into the configured AWS
// bucket as a single object named chunkID. The write is buffered and uploaded
// when the writer is closed.
func openS3Shard(key *settings.AWSKey, chunkID string) (io.WriteCloser, error) {
	w, err := newS3(key.Bucket, key.Region, key.AccessKeyID, key.SecretAccessKey).OpenWriter(chunkID)
	if err != nil {
		return nil, fmt.Errorf("open s3 shard: %w", err)
	}
	return w, nil
}

// folderForID returns the storage root (FolderPath/FolderName) of the
// configured Local provider whose ID matches, so a shard recorded against that
// provider can be located.
func folderForID(providers []settings.CloudKey, storageID string) (string, bool) {
	for _, k := range providers {
		if key, ok := k.(*settings.LocalKey); ok && key.GetID() == storageID {
			return filepath.Join(key.FolderPath, key.FolderName), true
		}
	}
	return "", false
}

// awsKeyForID returns the configured AWS provider whose ID matches, so a shard
// recorded against it can be read from or removed from its bucket.
func awsKeyForID(providers []settings.CloudKey, storageID string) (*settings.AWSKey, bool) {
	for _, k := range providers {
		if key, ok := k.(*settings.AWSKey); ok && key.GetID() == storageID {
			return key, true
		}
	}
	return nil, false
}
