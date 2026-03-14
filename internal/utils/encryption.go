package utils

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
	SaltSize = 16
	KeySize  = 32
	TimeCost = 3
	Memory   = 64 * 1024
	Threads  = 4
)

func GenerateRecoveryKey() (string, error) {
	const size = 32 // 256 bits

	b := make([]byte, size)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(b), nil
}

func GenerateSalt() ([]byte, error) {
	salt := make([]byte, SaltSize)

	_, err := io.ReadFull(rand.Reader, salt)
	if err != nil {
		return nil, err
	}

	return salt, nil
}

func GenerateMasterKey() ([]byte, error) {
	masterKey := make([]byte, KeySize)

	_, err := io.ReadFull(rand.Reader, masterKey)
	if err != nil {
		return nil, err
	}

	return masterKey, nil
}

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
