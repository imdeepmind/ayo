package dbconfig

import (
	"encoding/json"

	"ayo/internal/shared/crypto"
)

// encryptedBlob is the JSON shape persisted in the keyring. The credentials are
// wrapped twice, mirroring the master key pattern: once with a KEK derived from
// the password and once with a KEK derived from the recovery key, each with its
// own random salt. Each ciphertext carries its own embedded nonce (see
// crypto.EncryptData), so a password reset can re-wrap credentials using the
// recovery-key copy without the old password.
type encryptedBlob struct {
	PasswordSalt      []byte `json:"PasswordSalt"`
	PasswordEncrypted []byte `json:"PasswordEncrypted"`
	RecoverySalt      []byte `json:"RecoverySalt"`
	RecoveryEncrypted []byte `json:"RecoveryEncrypted"`
}

// EncryptDBCredentials serializes creds and wraps them with both the
// password-derived and recovery-key-derived KEKs. The returned blob is the JSON
// form ready to persist in the keyring.
func EncryptDBCredentials(password, recoveryKey string, creds DBCredentials) ([]byte, error) {
	plaintext, err := json.Marshal(creds)
	if err != nil {
		return nil, err
	}

	passwordSalt, err := crypto.GenerateSalt()
	if err != nil {
		return nil, err
	}
	passwordEncrypted, err := crypto.EncryptData(crypto.DeriveKEK(password, passwordSalt), plaintext)
	if err != nil {
		return nil, err
	}

	recoverySalt, err := crypto.GenerateSalt()
	if err != nil {
		return nil, err
	}
	recoveryEncrypted, err := crypto.EncryptData(crypto.DeriveKEK(recoveryKey, recoverySalt), plaintext)
	if err != nil {
		return nil, err
	}

	return json.Marshal(encryptedBlob{
		PasswordSalt:      passwordSalt,
		PasswordEncrypted: passwordEncrypted,
		RecoverySalt:      recoverySalt,
		RecoveryEncrypted: recoveryEncrypted,
	})
}

// DecryptDBCredentials unwraps a blob previously produced by
// EncryptDBCredentials using the password-derived KEK. A wrong password fails
// GCM authentication and returns an error.
func DecryptDBCredentials(password string, blob []byte) (DBCredentials, error) {
	return decrypt(password, blob, true)
}

// DecryptDBCredentialsWithRecovery unwraps a blob using the recovery-key-derived
// KEK. Used by the password-reset flow to recover credentials without the old
// password.
func DecryptDBCredentialsWithRecovery(recoveryKey string, blob []byte) (DBCredentials, error) {
	return decrypt(recoveryKey, blob, false)
}

func decrypt(secret string, blob []byte, fromPassword bool) (DBCredentials, error) {
	var e encryptedBlob
	if err := json.Unmarshal(blob, &e); err != nil {
		return DBCredentials{}, err
	}

	var kek []byte
	var encrypted []byte
	if fromPassword {
		kek = crypto.DeriveKEK(secret, e.PasswordSalt)
		encrypted = e.PasswordEncrypted
	} else {
		kek = crypto.DeriveKEK(secret, e.RecoverySalt)
		encrypted = e.RecoveryEncrypted
	}

	plaintext, err := crypto.DecryptData(kek, encrypted)
	if err != nil {
		return DBCredentials{}, err
	}

	var creds DBCredentials
	if err := json.Unmarshal(plaintext, &creds); err != nil {
		return DBCredentials{}, err
	}
	return creds, nil
}
