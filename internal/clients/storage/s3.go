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

// s3Client is a Client backed by an AWS S3 bucket. Every key is interpreted as
// an S3 object key in the bucket configured at construction time. It exists so
// shards can be written to and read back from a user's own bucket alongside the
// local filesystem backend; the Client interface is the shared seam. It is only
// constructed through the storage dispatch (OpenShardWriter/ResolveShard).
type s3Client struct {
	client *s3.Client
	bucket string
}

// newS3 returns a Client configured with static credentials for the given
// bucket and region.
func newS3(bucket, region, accessKeyID, secretAccessKey string) *s3Client {
	cfg := aws.Config{
		Region:      region,
		Credentials: credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, ""),
	}
	return &s3Client{
		client: s3.NewFromConfig(cfg),
		bucket: bucket,
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
// with a HeadBucket call, confirming the credentials, region and bucket name
// are correct. A PermanentRedirect is reported as a region misconfiguration
// since the credentials otherwise resolved. It is used to check settings before
// they are saved.
func (s *s3Client) Validate(key *settings.AWSKey) error {
	if key.AccessKeyID == "" || key.SecretAccessKey == "" || key.Region == "" || key.Bucket == "" {
		return fmt.Errorf("aws provider is incomplete: access key id, secret access key, region and bucket are required")
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
		slog.Error("validate aws provider", "bucket", s.bucket, "error", err)
		return fmt.Errorf(
			"unable to connect to your aws bucket %q: check your access key, secret access key, region and bucket name",
			s.bucket,
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
