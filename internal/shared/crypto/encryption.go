// Package crypto provides the low-level cryptographic primitives shared across
// features: key generation, Argon2id key derivation/hashing and AES-256-GCM
// encrypt/decrypt.
//
// It belongs to the shared tier. Features compose these primitives into their
// own flows rather than re-implementing crypto. The design follows a
// master-key scheme:
//
//   - A random 256-bit master key wraps per-file Data Encryption Keys (DEKs);
//     it never encrypts file payloads directly.
//   - Large files use envelope encryption: each file gets a fresh 256-bit DEK,
//     the payload is encrypted with the DEK, and the DEK is wrapped by the
//     master key (see GenerateDEK/WrapDEK and StreamEncrypt/StreamDecrypt).
//   - The master key is itself wrapped by KEKs derived with Argon2id from the
//     user's password and recovery key, so it is never stored in plaintext.
//   - Passwords and recovery keys are stored as self-describing Argon2id PHC
//     hashes (see HashPassword/VerifyPasswordHash in hash.go).
//
// The single argon2Params configuration feeds both the PHC password hashing
// and the raw KEK derivation, so every Argon2id use in the codebase shares one
// set of parameters. Password/recovery-key hashes are self-describing (their
// parameters are embedded in the PHC string), but KEKs are not, so these
// parameters must never change once material has been persisted.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	sharederrors "ayo/internal/shared/errors"

	"github.com/alexedwards/argon2id"
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

// argon2Params is the single Argon2id configuration used across the codebase,
// both for PHC password hashing and raw KEK derivation. It mirrors the
// constants above; changing them would make previously derived KEKs
// unrecoverable.
var argon2Params = &argon2id.Params{
	Memory:      Memory,
	Iterations:  TimeCost,
	Parallelism: Threads,
	SaltLength:  SaltSize,
	KeyLength:   KeySize,
}

// GenerateRecoveryKey returns a new random 256-bit recovery key encoded as a
// URL-safe base64 string. The returned []byte is a zeroable buffer so the
// caller can scrub it (see Wipe) after showing the value; it must be converted
// to a string only at the point of display. The user is shown this value
// exactly once (at registration/reset) and must store it somewhere safe.
func GenerateRecoveryKey() ([]byte, error) {
	const size = 32 // 256 bits

	b := make([]byte, size)
	if _, err := rand.Read(b); err != nil {
		return nil, fmt.Errorf("failed to generate random bytes: %w", err)
	}

	return []byte(base64.RawURLEncoding.EncodeToString(b)), nil
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

// GenerateDEK returns a new random 256-bit Data Encryption Key. Envelope
// encryption generates one fresh DEK per file: the file payload is encrypted
// with the DEK and the DEK itself is wrapped by the master key, so the master
// key is never reused to encrypt payload bytes directly.
func GenerateDEK() ([]byte, error) {
	dek := make([]byte, KeySize)

	_, err := io.ReadFull(rand.Reader, dek)
	if err != nil {
		return nil, err
	}

	return dek, nil
}

// GenerateNonce returns a random nonce of the AES-256-GCM nonce size (12
// bytes). Callers that persist a nonce must store it alongside the ciphertext
// it was used with.
func GenerateNonce() ([]byte, error) {
	nonce := make([]byte, 12)

	_, err := io.ReadFull(rand.Reader, nonce)
	if err != nil {
		return nil, err
	}

	return nonce, nil
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
// Argon2id. The result depends on argon2Params, so those parameters must not
// change after keys have been persisted.
func DeriveKEK(password []byte, salt []byte) []byte {
	kek := argon2.IDKey(
		password,
		salt,
		argon2Params.Iterations,
		argon2Params.Memory,
		argon2Params.Parallelism,
		argon2Params.KeyLength,
	)

	return kek
}

// WrapDEK seals a Data Encryption Key with the master key using AES-256-GCM,
// the "wrap" half of envelope encryption. It returns the wrapped key (a
// single blob: ciphertext ‖ authentication tag, 48 bytes) and the fresh
// 12-byte nonce that must be persisted alongside it for later unwrapping. The
// master key only ever encrypts DEKs this way, never file payloads directly.
func WrapDEK(masterKey []byte, dek []byte) ([]byte, []byte, error) {
	return EncryptMasterKey(masterKey, dek)
}

// UnwrapDEK reverses WrapDEK: it opens the wrapped DEK with the master key and
// the key nonce recorded at wrap time. A corrupted wrapped DEK or nonce fails
// the authentication check and returns an error, so a tampered key tag aborts
// decryption securely.
func UnwrapDEK(masterKey []byte, wrappedDEK []byte, keyNonce []byte) ([]byte, error) {
	return DecryptMasterKey(masterKey, wrappedDEK, keyNonce)
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
	plaintext, err := aead.Open(nil, nonce, encryptedData, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", sharederrors.ErrInvalidSecret, err)
	}
	return plaintext, nil
}

// dualEncryptedBlob is the JSON shape persisted for a value wrapped twice:
// once with a KEK derived from a password and once with a KEK derived from a
// recovery key, each with its own random salt. Each ciphertext carries its own
// embedded nonce (see EncryptData), so a password reset can re-wrap the value
// using the recovery-key copy without the old password.
type dualEncryptedBlob struct {
	PasswordSalt      []byte `json:"PasswordSalt"`
	PasswordEncrypted []byte `json:"PasswordEncrypted"`
	RecoverySalt      []byte `json:"RecoverySalt"`
	RecoveryEncrypted []byte `json:"RecoveryEncrypted"`
}

// DualEncrypt wraps plaintext with both a password-derived and a
// recovery-key-derived KEK using AES-256-GCM, mirroring the master-key pattern.
// The returned blob is the JSON form ready to persist. password and recoveryKey
// must be mutable copies of the secrets (see Wipe); the derived KEKs are
// scrubbed before returning. The caller owns plaintext and should wipe it.
func DualEncrypt(plaintext, password, recoveryKey []byte) ([]byte, error) {
	passwordSalt, err := GenerateSalt()
	if err != nil {
		return nil, err
	}
	passwordKek := DeriveKEK(password, passwordSalt)
	defer Wipe(passwordKek)
	passwordEncrypted, err := EncryptData(passwordKek, plaintext)
	if err != nil {
		return nil, err
	}

	recoverySalt, err := GenerateSalt()
	if err != nil {
		return nil, err
	}
	recoveryKek := DeriveKEK(recoveryKey, recoverySalt)
	defer Wipe(recoveryKek)
	recoveryEncrypted, err := EncryptData(recoveryKek, plaintext)
	if err != nil {
		return nil, err
	}

	return json.Marshal(dualEncryptedBlob{
		PasswordSalt:      passwordSalt,
		PasswordEncrypted: passwordEncrypted,
		RecoverySalt:      recoverySalt,
		RecoveryEncrypted: recoveryEncrypted,
	})
}

// DualDecrypt unwraps a blob previously produced by DualEncrypt. fromPassword
// selects the password-derived KEK (used on login); otherwise the
// recovery-key-derived KEK is used (used on password reset). A wrong secret
// fails GCM authentication and returns an error. secret must be a mutable copy
// (see Wipe); the transient KEK and plaintext are scrubbed before returning.
func DualDecrypt(blob, secret []byte, fromPassword bool) ([]byte, error) {
	var e dualEncryptedBlob
	if err := json.Unmarshal(blob, &e); err != nil {
		return nil, err
	}

	var kek []byte
	var encrypted []byte
	if fromPassword {
		kek = DeriveKEK(secret, e.PasswordSalt)
		encrypted = e.PasswordEncrypted
	} else {
		kek = DeriveKEK(secret, e.RecoverySalt)
		encrypted = e.RecoveryEncrypted
	}
	defer Wipe(kek)

	plaintext, err := DecryptData(kek, encrypted)
	if err != nil {
		return nil, err
	}
	return plaintext, nil
}

// StreamEncrypt encrypts data from reader to writer in fixed-size chunks,
// streaming through memory without loading the entire file. Each chunk is
// encrypted with AES-256-GCM using a derived nonce (base nonce + counter),
// providing authenticated encryption while supporting arbitrarily large files.
//
// The output format is:
//
//	[chunk1+tag][chunk2+tag]...
//
// Each chunk carries its own 16-byte authentication tag. This trades ~16 bytes
// per 64KB chunk (~0.02% overhead) for the ability to process files larger than
// available memory.
//
// dek must be the per-file Data Encryption Key (see GenerateDEK) and fileNonce
// the fresh 12-byte base nonce recorded for this file; together they let the
// caller apply envelope encryption: encrypt the payload with the DEK and store
// the DEK wrapped by the master key separately (see WrapDEK). The blob itself
// carries no header and no key material.
//
// The reader is consumed entirely; the writer receives the full encrypted stream.
// Both are the caller's responsibility to close.
func StreamEncrypt(reader io.Reader, writer io.Writer, dek []byte, fileNonce []byte) error {
	block, err := aes.NewCipher(dek)
	if err != nil {
		return fmt.Errorf("create cipher: %w", err)
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("create gcm: %w", err)
	}

	if len(fileNonce) != aead.NonceSize() {
		return fmt.Errorf("file nonce must be %d bytes, got %d", aead.NonceSize(), len(fileNonce))
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

		// Derive nonce for this chunk from the file nonce + counter.
		chunkNonce := deriveChunkNonce(fileNonce, counter)

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
// It decrypts each chunk using the file nonce + counter and the DEK that
// encrypted the payload.
//
// dek must be the per-file Data Encryption Key unwrapped from the master key
// (see UnwrapDEK) and fileNonce the 12-byte base nonce recorded for this file.
// The reader must carry data encrypted by StreamEncrypt. The writer receives
// the decrypted plaintext. Both are the caller's responsibility to close.
func StreamDecrypt(reader io.Reader, writer io.Writer, dek []byte, fileNonce []byte) error {
	block, err := aes.NewCipher(dek)
	if err != nil {
		return fmt.Errorf("create cipher: %w", err)
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("create gcm: %w", err)
	}

	if len(fileNonce) != aead.NonceSize() {
		return fmt.Errorf("file nonce must be %d bytes, got %d", aead.NonceSize(), len(fileNonce))
	}

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
		chunkNonce := deriveChunkNonce(fileNonce, counter)

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

// SplitKey splits a 32-byte master key into two equal-length components (pieceA
// and pieceB) using XOR-splitting (A ⊕ B = Key). Piece B is filled with random
// cryptographically secure bytes, and piece A is computed as key ⊕ pieceB.
// Neither piece alone reveals any information about the original key.
func SplitKey(key []byte) ([]byte, []byte, error) {
	if len(key) != KeySize {
		return nil, nil, fmt.Errorf("invalid key length: expected %d bytes, got %d", KeySize, len(key))
	}

	pieceB := make([]byte, KeySize)
	if _, err := io.ReadFull(rand.Reader, pieceB); err != nil {
		return nil, nil, fmt.Errorf("generate random piece: %w", err)
	}

	pieceA := make([]byte, KeySize)
	for i := 0; i < KeySize; i++ {
		pieceA[i] = key[i] ^ pieceB[i]
	}

	return pieceA, pieceB, nil
}

// CombineKey reconstructs the original 32-byte master key from XOR components
// pieceA and pieceB (A ⊕ B = Key).
func CombineKey(pieceA, pieceB []byte) ([]byte, error) {
	if len(pieceA) != KeySize || len(pieceB) != KeySize {
		return nil, fmt.Errorf(
			"invalid piece length: expected %d bytes each, got %d and %d",
			KeySize, len(pieceA), len(pieceB),
		)
	}

	key := make([]byte, KeySize)
	for i := 0; i < KeySize; i++ {
		key[i] = pieceA[i] ^ pieceB[i]
	}
	return key, nil
}

// CombineKeyToBuffer reconstructs the original 32-byte master key into the
// pre-allocated dst buffer (such as a memguard LockedBuffer).
func CombineKeyToBuffer(pieceA, pieceB, dst []byte) error {
	if len(pieceA) != KeySize || len(pieceB) != KeySize || len(dst) != KeySize {
		return fmt.Errorf(
			"invalid slice length: expected %d bytes each, got pieceA=%d, pieceB=%d, dst=%d",
			KeySize, len(pieceA), len(pieceB), len(dst),
		)
	}

	for i := 0; i < KeySize; i++ {
		dst[i] = pieceA[i] ^ pieceB[i]
	}
	return nil
}
