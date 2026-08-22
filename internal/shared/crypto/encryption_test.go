package crypto

import (
	"bytes"
	"testing"
)

// testPayload returns a deterministic plaintext of the given size.
func testPayload(size int) []byte {
	b := make([]byte, size)
	for i := range b {
		b[i] = byte(i * 7)
	}
	return b
}

// envelopeEncrypt encrypts plaintext end to end and returns the wrapped DEK, key
// nonce, file nonce and the encrypted blob.
func envelopeEncrypt(t *testing.T, masterKey, plaintext []byte) (wrappedDEK, keyNonce, fileNonce, blob []byte) {
	t.Helper()

	dek, err := GenerateDEK()
	if err != nil {
		t.Fatalf("GenerateDEK: %v", err)
	}

	wrappedDEK, keyNonce, err = WrapDEK(masterKey, dek)
	if err != nil {
		t.Fatalf("WrapDEK: %v", err)
	}

	fileNonce, err = GenerateNonce()
	if err != nil {
		t.Fatalf("GenerateNonce: %v", err)
	}

	var out bytes.Buffer
	if err := StreamEncrypt(bytes.NewReader(plaintext), &out, dek, fileNonce); err != nil {
		t.Fatalf("StreamEncrypt: %v", err)
	}

	return wrappedDEK, keyNonce, fileNonce, out.Bytes()
}

// envelopeDecrypt unwraps the DEK and decrypts the blob back to plaintext.
func envelopeDecrypt(t *testing.T, masterKey, wrappedDEK, keyNonce, fileNonce, blob []byte) []byte {
	t.Helper()

	dek, err := UnwrapDEK(masterKey, wrappedDEK, keyNonce)
	if err != nil {
		t.Fatalf("UnwrapDEK: %v", err)
	}

	var out bytes.Buffer
	if err := StreamDecrypt(bytes.NewReader(blob), &out, dek, fileNonce); err != nil {
		t.Fatalf("StreamDecrypt: %v", err)
	}

	return out.Bytes()
}

// TestStreamEnvelopeRoundTrip encrypts a multi-chunk payload (larger than one
// 64KB chunk) plus a single-byte and empty payload through the full envelope
// pipeline and verifies the decrypted output matches the input.
func TestStreamEnvelopeRoundTrip(t *testing.T) {
	masterKey, err := GenerateMasterKey()
	if err != nil {
		t.Fatalf("GenerateMasterKey: %v", err)
	}

	sizes := []int{0, 1, ChunkSize, 3*ChunkSize + 4096}
	for _, size := range sizes {
		t.Run("size", func(t *testing.T) {
			plaintext := testPayload(size)

			wrappedDEK, keyNonce, fileNonce, blob := envelopeEncrypt(t, masterKey, plaintext)
			got := envelopeDecrypt(t, masterKey, wrappedDEK, keyNonce, fileNonce, blob)

			if !bytes.Equal(got, plaintext) {
				t.Fatalf("round trip mismatch: got %d bytes, want %d", len(got), len(plaintext))
			}
		})
	}
}

// TestGenerateDEKIsFreshAndSized verifies each DEK is 32 bytes and that two
// generated keys are distinct (a brand-new DEK per file).
func TestGenerateDEKIsFreshAndSized(t *testing.T) {
	a, err := GenerateDEK()
	if err != nil {
		t.Fatalf("GenerateDEK: %v", err)
	}
	b, err := GenerateDEK()
	if err != nil {
		t.Fatalf("GenerateDEK: %v", err)
	}

	if len(a) != KeySize {
		t.Fatalf("DEK size = %d, want %d", len(a), KeySize)
	}
	if bytes.Equal(a, b) {
		t.Fatal("two generated DEKs are identical")
	}
}

// TestFreshEnvelopePerEncryption verifies that encrypting the same plaintext
// twice with the same master key produces a different wrapped DEK and file
// nonce (a fresh DEK and nonce are generated every single time).
func TestFreshEnvelopePerEncryption(t *testing.T) {
	masterKey, err := GenerateMasterKey()
	if err != nil {
		t.Fatalf("GenerateMasterKey: %v", err)
	}
	plaintext := testPayload(ChunkSize + 1)

	dekA, keyNonceA, fileNonceA, blobA := envelopeEncrypt(t, masterKey, plaintext)
	dekB, keyNonceB, fileNonceB, blobB := envelopeEncrypt(t, masterKey, plaintext)

	if bytes.Equal(dekA, dekB) {
		t.Fatal("wrapped DEKs are identical across two encryptions")
	}
	if bytes.Equal(keyNonceA, keyNonceB) {
		t.Fatal("key nonces are identical across two encryptions")
	}
	if bytes.Equal(fileNonceA, fileNonceB) {
		t.Fatal("file nonces are identical across two encryptions")
	}
	if bytes.Equal(blobA, blobB) {
		t.Fatal("encrypted blobs are identical across two encryptions")
	}

	if got := envelopeDecrypt(t, masterKey, dekA, keyNonceA, fileNonceA, blobA); !bytes.Equal(got, plaintext) {
		t.Fatal("first envelope failed to decrypt")
	}
	if got := envelopeDecrypt(t, masterKey, dekB, keyNonceB, fileNonceB, blobB); !bytes.Equal(got, plaintext) {
		t.Fatal("second envelope failed to decrypt")
	}
}

// TestCorruptKeyAuthTagFails verifies that a corrupted wrapped DEK (its
// authentication tag or ciphertext) makes UnwrapDEK fail, so decryption aborts
// securely before any payload bytes are processed.
func TestCorruptKeyAuthTagFails(t *testing.T) {
	masterKey, err := GenerateMasterKey()
	if err != nil {
		t.Fatalf("GenerateMasterKey: %v", err)
	}
	plaintext := testPayload(ChunkSize)

	wrappedDEK, keyNonce, _, _ := envelopeEncrypt(t, masterKey, plaintext)

	// Corrupt one byte in the wrapped DEK ciphertext and again in its tag.
	for _, idx := range []int{0, len(wrappedDEK) - 1} {
		corrupted := make([]byte, len(wrappedDEK))
		copy(corrupted, wrappedDEK)
		corrupted[idx] ^= 0x01

		if _, err := UnwrapDEK(masterKey, corrupted, keyNonce); err == nil {
			t.Fatalf("UnwrapDEK accepted corrupted wrapped DEK at byte %d", idx)
		}
	}

	// Corrupt the key nonce.
	badNonce := make([]byte, len(keyNonce))
	copy(badNonce, keyNonce)
	badNonce[0] ^= 0x01
	if _, err := UnwrapDEK(masterKey, wrappedDEK, badNonce); err == nil {
		t.Fatal("UnwrapDEK accepted corrupted key nonce")
	}
}

// TestCorruptFileAuthTagFails verifies that a corrupted payload chunk (its
// ciphertext or authentication tag) makes StreamDecrypt fail securely.
func TestCorruptFileAuthTagFails(t *testing.T) {
	masterKey, err := GenerateMasterKey()
	if err != nil {
		t.Fatalf("GenerateMasterKey: %v", err)
	}
	// Use several chunks so corruption can hit a body chunk and a trailing tag.
	plaintext := testPayload(3 * ChunkSize)

	wrappedDEK, keyNonce, fileNonce, blob := envelopeEncrypt(t, masterKey, plaintext)
	dek, err := UnwrapDEK(masterKey, wrappedDEK, keyNonce)
	if err != nil {
		t.Fatalf("UnwrapDEK: %v", err)
	}

	// Corrupt one byte inside a chunk ciphertext and one byte in a tag.
	for _, idx := range []int{ChunkSize / 2, len(blob) - 1} {
		corrupted := make([]byte, len(blob))
		copy(corrupted, blob)
		corrupted[idx] ^= 0x01

		var out bytes.Buffer
		if err := StreamDecrypt(bytes.NewReader(corrupted), &out, dek, fileNonce); err == nil {
			t.Fatalf("StreamDecrypt accepted corrupted blob at byte %d", idx)
		}
	}
}

// TestMasterKeyCannotDecryptPayload verifies the master key is never used to
// encrypt payload bytes: feeding the master key in place of the DEK must fail
// to decrypt the blob.
func TestMasterKeyCannotDecryptPayload(t *testing.T) {
	masterKey, err := GenerateMasterKey()
	if err != nil {
		t.Fatalf("GenerateMasterKey: %v", err)
	}
	plaintext := testPayload(ChunkSize + 1)

	_, _, fileNonce, blob := envelopeEncrypt(t, masterKey, plaintext)

	// Use the master key directly as the payload key: this must not decrypt.
	var out bytes.Buffer
	if err := StreamDecrypt(bytes.NewReader(blob), &out, masterKey, fileNonce); err == nil {
		t.Fatal("StreamDecrypt decrypted payload with the master key; payload is not DEK-encrypted")
	}
}

// TestStreamRequiresNonceSize verifies a wrong-sized file nonce is rejected
// up front rather than silently producing a corrupted stream.
func TestStreamRequiresNonceSize(t *testing.T) {
	dek, err := GenerateDEK()
	if err != nil {
		t.Fatalf("GenerateDEK: %v", err)
	}

	badNonce := make([]byte, 16)
	var out bytes.Buffer
	if err := StreamEncrypt(bytes.NewReader(testPayload(10)), &out, dek, badNonce); err == nil {
		t.Fatal("StreamEncrypt accepted a 16-byte file nonce")
	}
}
