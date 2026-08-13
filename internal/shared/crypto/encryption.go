// Package crypto provides the low-level cryptographic primitives shared across
// features: key generation, Argon2id key derivation and AES-256-GCM
// encrypt/decrypt.
//
// It belongs to the shared tier. Features compose these primitives into their
// own flows rather than re-implementing crypto. The design follows a
// master-key scheme:
//
//   - A random 256-bit master key encrypts the user's data (e.g. settings).
//   - The master key is itself wrapped by KEKs derived with Argon2id from the
//     user's password and recovery key, so it is never stored in plaintext.
//
// All constants below must be kept in sync across every use - changing the
// Argon2 parameters would make previously derived KEKs unrecoverable.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"

	"golang.org/x/crypto/argon2"
)

const (
	// SaltSize is the length of Argon2id salts in bytes.
	SaltSize = 16
	// KeySize is the length of generated keys and derived KEKs in bytes
	// (256 bits).
	KeySize = 32
	// TimeCost, Memory and Threads are the Argon2id parameters: time cost,
	// memory in KiB (64 MiB) and parallelism respectively. They are a trade-off
	// between KDF cost and responsiveness.
	TimeCost = 3
	Memory   = 64 * 1024
	Threads  = 4

	// ChunkSize is the size of each plaintext chunk for streaming encryption.
	// Each chunk is encrypted independently with its own derived nonce and
	// authentication tag. 64KB provides a good balance between memory usage
	// and performance.
	ChunkSize = 64 * 1024 // 64 KB
)

// GenerateRecoveryKey returns a new random 256-bit recovery key encoded as a
// URL-safe base64 string. The user is shown this value exactly once (at
// registration/reset) and must store it somewhere safe.
func GenerateRecoveryKey() (string, error) {
	const size = 32 // 256 bits

	b := make([]byte, size)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(b), nil
}

// GenerateSalt returns a random salt for use with DeriveKEK. Salts are
// per-user and stored alongside the wrapped master key.
func GenerateSalt() ([]byte, error) {
	salt := make([]byte, SaltSize)

	_, err := io.ReadFull(rand.Reader, salt)
	if err != nil {
		return nil, err
	}

	return salt, nil
}

// GenerateMasterKey returns a new random 256-bit master key used to encrypt
// the user's data. It is generated once per user and wrapped, never stored
// in plaintext.
func GenerateMasterKey() ([]byte, error) {
	masterKey := make([]byte, KeySize)

	_, err := io.ReadFull(rand.Reader, masterKey)
	if err != nil {
		return nil, err
	}

	return masterKey, nil
}

// EncryptMasterKey wraps a master key with a KEK using AES-256-GCM. It
// returns the ciphertext and the random nonce that must be stored alongside
// it for later decryption.
func EncryptMasterKey(kek []byte, masterKey []byte) ([]byte, []byte, error) {
	block, err := aes.NewCipher(kek)
	if err != nil {
		return nil, nil, err
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, err
	}

	return aead.Seal(nil, nonce, masterKey, nil), nonce, nil
}

// DecryptMasterKey unwraps a master key previously wrapped by EncryptMasterKey
// using the same KEK and nonce.
func DecryptMasterKey(kek []byte, encryptedMasterKey []byte, nonce []byte) ([]byte, error) {
	block, err := aes.NewCipher(kek)
	if err != nil {
		return nil, err
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	mk, err := aead.Open(nil, nonce, encryptedMasterKey, nil)
	if err != nil {
		return nil, err
	}

	return mk, nil
}

// DeriveKEK derives a Key Encryption Key from a password and salt using
// Argon2id. The result depends on TimeCost/Memory/Threads/KeySize, so those
// constants must not change after keys have been persisted.
func DeriveKEK(password string, salt []byte) []byte {
	kek := argon2.IDKey(
		[]byte(password),
		salt,
		TimeCost,
		Memory,
		Threads,
		KeySize,
	)

	return kek
}

// EncryptData encrypts arbitrary plaintext (e.g. the settings JSON) with the
// master key using AES-256-GCM. The random nonce is prepended to the returned
// ciphertext, so the output carries everything DecryptData needs.
func EncryptData(key []byte, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	// Prepend nonce to ciphertext
	return aead.Seal(nonce, nonce, plaintext, nil), nil
}

// DecryptData reverses EncryptData: it reads the nonce from the front of the
// ciphertext and decrypts the remainder. The master key must be the same key
// used to encrypt.
func DecryptData(key []byte, ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := aead.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, encryptedData := ciphertext[:nonceSize], ciphertext[nonceSize:]
	return aead.Open(nil, nonce, encryptedData, nil)
}

// StreamEncrypt encrypts data from reader to writer in fixed-size chunks,
// streaming through memory without loading the entire file. Each chunk is
// encrypted with AES-256-GCM using a derived nonce (base nonce + counter),
// providing authenticated encryption while supporting arbitrarily large files.
//
// The output format is:
//
//	[16-byte salt][12-byte base nonce][chunk1+tag][chunk2+tag]...
//
// Each chunk carries its own 16-byte authentication tag. This trades ~28 bytes
// per 64KB chunk (~0.04% overhead) for the ability to process files larger than
// available memory.
//
// The reader is consumed entirely; the writer receives the full encrypted stream.
// Both are the caller's responsibility to close.
func StreamEncrypt(reader io.Reader, writer io.Writer, key []byte) error {
	block, err := aes.NewCipher(key)
	if err != nil {
		return fmt.Errorf("create cipher: %w", err)
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("create gcm: %w", err)
	}

	// Generate random base nonce for this file. Each chunk derives its nonce
	// from this base + chunk counter.
	baseNonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, baseNonce); err != nil {
		return fmt.Errorf("generate base nonce: %w", err)
	}

	// Generate salt (currently unused but included for format consistency and
	// future extensibility, e.g., key derivation per file).
	salt := make([]byte, SaltSize)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return fmt.Errorf("generate salt: %w", err)
	}

	// Write header: salt, base nonce.
	header := append(salt, baseNonce...)
	if _, err := writer.Write(header); err != nil {
		return fmt.Errorf("write header: %w", err)
	}

	// Encrypt and write chunks.
	chunk := make([]byte, ChunkSize)
	var counter uint64
	for {
		n, err := io.ReadFull(reader, chunk)
		if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
			return fmt.Errorf("read chunk: %w", err)
		}
		if n == 0 {
			break
		}

		// Derive nonce for this chunk from base nonce + counter.
		chunkNonce := deriveChunkNonce(baseNonce, counter)

		// Encrypt chunk with its derived nonce. The tag is appended by Seal.
		ciphertext := aead.Seal(nil, chunkNonce, chunk[:n], nil)

		if _, err := writer.Write(ciphertext); err != nil {
			return fmt.Errorf("write chunk: %w", err)
		}

		counter++

		// EOF after reading partial chunk means we're done.
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			break
		}
	}

	return nil
}

// StreamDecrypt decrypts data from reader to writer, reversing StreamEncrypt.
// It reads the header (salt, base nonce), then decrypts each chunk using the
// derived nonce (base + counter).
//
// The reader must carry data encrypted by StreamEncrypt. The writer receives
// the decrypted plaintext. Both are the caller's responsibility to close.
func StreamDecrypt(reader io.Reader, writer io.Writer, key []byte) error {
	block, err := aes.NewCipher(key)
	if err != nil {
		return fmt.Errorf("create cipher: %w", err)
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("create gcm: %w", err)
	}

	// Read header: salt, base nonce.
	header := make([]byte, SaltSize+aead.NonceSize())
	if _, err := io.ReadFull(reader, header); err != nil {
		return fmt.Errorf("read header: %w", err)
	}

	// salt := header[:SaltSize] // reserved for future use
	baseNonce := header[SaltSize:]

	// Decrypt chunks.
	// Each encrypted chunk is plaintext + 16-byte tag.
	ciphertextChunkSize := ChunkSize + aead.Overhead()
	ciphertextChunk := make([]byte, ciphertextChunkSize)
	var counter uint64

	for {
		n, err := io.ReadFull(reader, ciphertextChunk)
		if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
			return fmt.Errorf("read chunk: %w", err)
		}
		if n == 0 {
			break
		}

		// Derive nonce for this chunk.
		chunkNonce := deriveChunkNonce(baseNonce, counter)

		// Decrypt chunk.
		plaintext, err := aead.Open(nil, chunkNonce, ciphertextChunk[:n], nil)
		if err != nil {
			return fmt.Errorf("decrypt chunk %d: %w", counter, err)
		}

		if _, err := writer.Write(plaintext); err != nil {
			return fmt.Errorf("write plaintext: %w", err)
		}

		counter++

		// EOF after reading partial chunk means we're done.
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			break
		}
	}

	return nil
}

// deriveChunkNonce derives a unique nonce for a chunk by combining the base
// nonce with a counter. The counter is encoded as an 8-byte big-endian integer
// and XORed with the last 8 bytes of the base nonce, ensuring each chunk has
// a distinct nonce while keeping nonce size at 12 bytes (GCM standard).
//
// This approach is safe for up to 2^64 chunks per file (> 1 exabyte at 64KB
// chunks), well beyond practical file sizes.
func deriveChunkNonce(baseNonce []byte, counter uint64) []byte {
	nonce := make([]byte, len(baseNonce))
	copy(nonce, baseNonce)

	// XOR the big-endian counter into the last 8 bytes of the nonce.
	var counterBytes [8]byte
	binary.BigEndian.PutUint64(counterBytes[:], counter)
	for i := 0; i < 8; i++ {
		nonce[len(nonce)-8+i] ^= counterBytes[i]
	}

	return nonce
}
