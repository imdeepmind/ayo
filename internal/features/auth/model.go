package auth

import (
	"ayo/internal/features/masterkey"
)

// User is the persisted representation of an account, mirroring one row of the
// `users` table. It stores only hashes and encrypted material - never plaintext
// credentials or keys. The plaintext recovery key is returned to the caller via
// RegisterResult instead of being stored here.
type User struct {
	ID       int64
	Username string

	// PasswordHash is the bcrypt hash of the account password. It is used to
	// verify logins without ever holding the password itself.
	PasswordHash string
	// RecoveryKey is the bcrypt hash of the recovery key. The raw recovery key
	// is shown to the user exactly once at registration/reset time.
	RecoveryKey string

	// The user's master key encrypts all of their data (e.g. settings). It is
	// generated once at registration and is itself wrapped (AES-256-GCM) by two
	// KEKs derived via Argon2id from the password and the recovery key. Only the
	// wrapped form is stored here, so the master key can never be recovered from
	// the database alone.

	// PasswordSalt/Nonce/MasterKey: salt + nonce + wrapped master key for the
	// password-derived KEK.
	PasswordSalt      []byte
	PasswordNonce     []byte
	PasswordMasterKey []byte
	// RecoverySalt/Nonce/MasterKey: salt + nonce + wrapped master key for the
	// recovery-key-derived KEK.
	RecoverySalt      []byte
	RecoveryNonce     []byte
	RecoveryMasterKey []byte
}

// MasterKeyMaterial returns the user's encrypted master-key material as read
// from the users table. When the account stores its material in the OS keyring
// instead, these columns carry junk and callers must load the material from the
// keyring via the masterkey repository.
func (u *User) MasterKeyMaterial() *masterkey.Material {
	return &masterkey.Material{
		PasswordSalt:      u.PasswordSalt,
		PasswordNonce:     u.PasswordNonce,
		PasswordMasterKey: u.PasswordMasterKey,
		RecoverySalt:      u.RecoverySalt,
		RecoveryNonce:     u.RecoveryNonce,
		RecoveryMasterKey: u.RecoveryMasterKey,
	}
}
