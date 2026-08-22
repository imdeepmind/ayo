package auth

import (
	"ayo/internal/features/masterkey"
)

// User is the persisted representation of an account, mirroring one row of the
// `users` table. It stores only hashes and encrypted material - never plaintext
// credentials or keys. The plaintext recovery key is returned to the caller via
// RegisterResult instead of being stored here.
//
// Only ID and Username are exported. The password/recovery-key hashes and the
// wrapped master-key material are internal to package auth: Wails only
// serializes exported fields, so a RegisterResult's User reaches the frontend as
// just the account identity, never its secrets. Keep every sensitive column
// unexported so no service method can leak it to the UI.
type User struct {
	ID       int64
	Username string

	// passwordHash is the Argon2id PHC hash of the account password. It is used
	// to verify logins without ever holding the password itself.
	passwordHash string
	// recoveryKey is the Argon2id PHC hash of the recovery key. The raw
	// recovery key is shown to the user exactly once at registration/reset time.
	recoveryKey string

	// The user's master key encrypts all of their data (e.g. settings). It is
	// generated once at registration and is itself wrapped (AES-256-GCM) by two
	// KEKs derived via Argon2id from the password and the recovery key. Only the
	// wrapped form is stored here, so the master key can never be recovered from
	// the database alone.

	// passwordSalt/nonce/masterKey: salt + nonce + wrapped master key for the
	// password-derived KEK.
	passwordSalt      []byte
	passwordNonce     []byte
	passwordMasterKey []byte
	// recoverySalt/nonce/masterKey: salt + nonce + wrapped master key for the
	// recovery-key-derived KEK.
	recoverySalt      []byte
	recoveryNonce     []byte
	recoveryMasterKey []byte
}

// MasterKeyMaterial returns the user's encrypted master-key material as read
// from the users table. When the account stores its material in the OS keyring
// instead, these columns carry junk and callers must load the material from the
// keyring via the masterkey repository.
func (u *User) MasterKeyMaterial() *masterkey.Material {
	return &masterkey.Material{
		PasswordSalt:      u.passwordSalt,
		PasswordNonce:     u.passwordNonce,
		PasswordMasterKey: u.passwordMasterKey,
		RecoverySalt:      u.recoverySalt,
		RecoveryNonce:     u.recoveryNonce,
		RecoveryMasterKey: u.recoveryMasterKey,
	}
}
