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
