package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

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
