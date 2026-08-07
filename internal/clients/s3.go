package clients

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3 is a Client backed by an AWS S3 bucket. Every key is interpreted as an S3
// object key in the bucket configured at construction time. It exists so shards
// can be written to and read back from a user's own bucket alongside the local
// filesystem backend; the Client interface is the shared seam.
//
// Object storage has no directories or mode bits, so MkdirAll and RemoveAll are
// no-ops (the latter is only called for legacy local folders, never here), and
// mode arguments are ignored.
type S3 struct {
	client *s3.Client
	bucket string
}

// NewS3 returns a Client configured with static credentials for the given
// bucket and region.
func NewS3(bucket, region, accessKeyID, secretAccessKey string) (*S3, error) {
	cfg := aws.Config{
		Region:      region,
		Credentials: credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, ""),
	}
	return &S3{
		client: s3.NewFromConfig(cfg),
		bucket: bucket,
	}, nil
}

// ReadFile reads the whole object at key. A missing object yields an error, so
// the erasure-coding layer can treat it as a lost shard to recover from parity.
func (s *S3) ReadFile(key string) ([]byte, error) {
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

// WriteFile writes data to key with a single PutObject.
func (s *S3) WriteFile(key string, data []byte, _ os.FileMode) error {
	_, err := s.client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
		Body:   bytes.NewReader(data),
	})
	if err != nil {
		return fmt.Errorf("write s3 object: %w", err)
	}
	return nil
}

// MkdirAll is a no-op: S3 has no directories.
func (s *S3) MkdirAll(string, os.FileMode) error {
	return nil
}

// OpenWriter returns a writer that buffers the shard in memory and uploads it
// with a single PutObject when closed. Shards are bounded by the erasure-coding
// planner (at most a few MiB), so buffering keeps the operation atomic: either
// the whole object is uploaded or the job fails, and the SDK's built-in retries
// cover transient failures.
func (s *S3) OpenWriter(key string) (io.WriteCloser, error) {
	return &s3ShardWriter{
		client: s.client,
		bucket: s.bucket,
		key:    key,
	}, nil
}

// Stat reports whether the object at key exists, exposing its size.
func (s *S3) Stat(key string) (os.FileInfo, error) {
	out, err := s.client.HeadObject(context.Background(), &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("stat s3 object: %w", err)
	}
	var size int64
	if out.ContentLength != nil {
		size = *out.ContentLength
	}
	return &s3FileInfo{size: size}, nil
}

// Remove deletes the object at key. S3 deletes are idempotent.
func (s *S3) Remove(key string) error {
	_, err := s.client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("remove s3 object: %w", err)
	}
	return nil
}

// RemoveAll is a no-op: S3 has no directories to remove recursively.
func (s *S3) RemoveAll(string) error {
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

// s3FileInfo is a minimal os.FileInfo backed by HeadObject metadata.
type s3FileInfo struct {
	size int64
}

func (f *s3FileInfo) Name() string       { return "" }
func (f *s3FileInfo) Size() int64        { return f.size }
func (f *s3FileInfo) Mode() os.FileMode  { return 0o600 }
func (f *s3FileInfo) ModTime() time.Time { return time.Time{} }
func (f *s3FileInfo) IsDir() bool        { return false }
func (f *s3FileInfo) Sys() any           { return nil }

// ensure S3 satisfies the Client interface at compile time.
var _ Client = (*S3)(nil)
