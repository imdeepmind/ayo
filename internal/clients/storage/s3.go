package storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"time"

	"ayo/internal/features/settings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
)

// s3PingTimeout bounds how long validating an AWS provider may wait for a
// bucket response, including SDK retries, so a misconfigured key or region
// fails fast instead of hanging the settings save.
const s3PingTimeout = 10 * time.Second

// s3Client is a Client backed by an S3-compatible bucket (AWS S3, MinIO,
// Backblaze B2, Cloudflare R2 or Wasabi). Every key is interpreted as an object
// key in the bucket configured at construction time. It exists so shards can be
// written to and read back from a user's own bucket alongside the local
// filesystem backend; the Client interface is the shared seam. It is only
// constructed through the storage dispatch (OpenShardWriter/ResolveShard).
type s3Client struct {
	client *s3.Client
	bucket string
}

// s3Endpoint returns the custom base endpoint and whether path-style addressing
// is required for an S3-compatible provider. Hosted vendors (AWS, Backblaze,
// Cloudflare R2, Wasabi) derive their endpoint from the key's region or account
// id, so the endpoint stays hidden from the user. MinIO is self-hosted, so the
// user-provided server URL (key.Endpoint) is used with path-style addressing.
// An empty endpoint means the SDK's default AWS endpoint resolution applies.
func s3Endpoint(key *settings.AWSKey) (endpoint string, forcePathStyle bool) {
	switch key.Provider {
	case settings.MinIO:
		return key.Endpoint, true
	case settings.Backblaze:
		return "https://s3." + key.Region + ".backblazeb2.com", false
	case settings.Cloudflare:
		return "https://" + key.AccountID + ".r2.cloudflarestorage.com", false
	case settings.Wasabi:
		return "https://s3." + key.Region + ".wasabisys.com", false
	default:
		return "", false
	}
}

// s3Region returns the AWS SDK region to use for a provider. Cloudflare R2 and
// MinIO have no real region in the key, so a fixed value is used instead.
func s3Region(key *settings.AWSKey) string {
	switch key.Provider {
	case settings.Cloudflare:
		return "auto"
	case settings.MinIO:
		if key.Region == "" {
			return "us-east-1"
		}
		return key.Region
	default:
		return key.Region
	}
}

// providerDisplayName returns the user-facing name for a provider, used in
// validation error messages.
func providerDisplayName(p settings.Provider) string {
	switch p {
	case settings.AWS:
		return "aws s3"
	case settings.MinIO:
		return "minio"
	case settings.Backblaze:
		return "backblaze b2"
	case settings.Cloudflare:
		return "cloudflare r2"
	case settings.Wasabi:
		return "wasabi"
	default:
		return string(p)
	}
}

// newS3 returns a Client configured with static credentials for the given
// S3-compatible key. The endpoint (hosted vendors derived, MinIO from the key)
// and path-style flag are resolved per provider type.
func newS3(key *settings.AWSKey) *s3Client {
	endpoint, forcePathStyle := s3Endpoint(key)
	cfg := aws.Config{
		Region:      s3Region(key),
		Credentials: credentials.NewStaticCredentialsProvider(key.AccessKeyID, key.SecretAccessKey, ""),
	}
	var opts []func(*s3.Options)
	if endpoint != "" {
		cfg.BaseEndpoint = aws.String(endpoint)
		if forcePathStyle {
			opts = append(opts, func(o *s3.Options) { o.UsePathStyle = true })
		}
	}
	return &s3Client{
		client: s3.NewFromConfig(cfg, opts...),
		bucket: key.Bucket,
	}
}

// ReadFile reads the whole object at key. A missing object yields an error, so
// the erasure-coding layer can treat it as a lost shard to recover from parity.
func (s *s3Client) ReadFile(key string) ([]byte, error) {
	out, err := s.client.GetObject(context.Background(), &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("read s3 object: %w", err)
	}
	defer out.Body.Close()

	data, err := io.ReadAll(out.Body)
	if err != nil {
		return nil, fmt.Errorf("read s3 object body: %w", err)
	}
	return data, nil
}

// OpenReader opens key for streaming read and returns an io.ReadCloser.
// The caller must close the returned reader to release resources.
func (s *s3Client) OpenReader(key string) (io.ReadCloser, error) {
	out, err := s.client.GetObject(context.Background(), &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("open s3 object for read: %w", err)
	}
	return out.Body, nil
}

// OpenWriter returns a writer that buffers the shard in memory and uploads it
// with a single PutObject when closed. Shards are bounded by the erasure-coding
// planner (at most a few MiB), so buffering keeps the operation atomic: either
// the whole object is uploaded or the job fails, and the SDK's built-in retries
// cover transient failures.
func (s *s3Client) OpenWriter(key string) (io.WriteCloser, error) {
	return &s3ShardWriter{
		client: s.client,
		bucket: s.bucket,
		key:    key,
	}, nil
}

// Remove deletes the object at key. S3 deletes are idempotent.
func (s *s3Client) Remove(key string) error {
	_, err := s.client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("remove s3 object: %w", err)
	}
	return nil
}

// Validate checks the provider's required fields are set and pings the bucket
// with a HeadBucket call, confirming the credentials and bucket name are
// correct. A PermanentRedirect is reported as a region misconfiguration since
// the credentials otherwise resolved. It is used to check settings before they
// are saved.
func (s *s3Client) Validate(key *settings.AWSKey) error {
	name := providerDisplayName(key.Provider)
	if key.AccessKeyID == "" || key.SecretAccessKey == "" || key.Bucket == "" {
		return fmt.Errorf("%s provider is incomplete: access key id, secret access key and bucket are required", name)
	}

	switch key.Provider {
	case settings.AWS, settings.Backblaze, settings.Wasabi:
		if key.Region == "" {
			return fmt.Errorf("%s provider is incomplete: region is required", name)
		}
	case settings.Cloudflare:
		if key.AccountID == "" {
			return fmt.Errorf("%s provider is incomplete: account id is required", name)
		}
	case settings.MinIO:
		if key.Endpoint == "" {
			return fmt.Errorf("%s provider is incomplete: server url is required", name)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), s3PingTimeout)
	defer cancel()

	if _, err := s.client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(s.bucket),
	}); err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && apiErr.ErrorCode() == "PermanentRedirect" {
			return fmt.Errorf("bucket %q exists in a region other than %q: check the region setting", s.bucket, key.Region)
		}
		slog.Error("validate storage provider", "provider", key.Provider, "bucket", s.bucket, "error", err)
		return fmt.Errorf(
			"unable to connect to your %s bucket %q: check your credentials and provider settings",
			name, s.bucket,
		)
	}
	return nil
}

// s3ShardWriter buffers bytes written by the erasure-coding encoder and uploads
// them as one object on Close.
type s3ShardWriter struct {
	client *s3.Client
	bucket string
	key    string
	buf    bytes.Buffer
}

func (w *s3ShardWriter) Write(p []byte) (int, error) {
	return w.buf.Write(p)
}

func (w *s3ShardWriter) Close() error {
	_, err := w.client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket: aws.String(w.bucket),
		Key:    aws.String(w.key),
		Body:   bytes.NewReader(w.buf.Bytes()),
	})
	if err != nil {
		return fmt.Errorf("upload s3 object: %w", err)
	}
	return nil
}

// ensure s3Client satisfies the Client interface at compile time.
var _ Client = (*s3Client)(nil)
