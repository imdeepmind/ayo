package auth

import (
	dbclient "ayo/internal/clients/db"
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
// keyring via the master-key repository.
func (u *User) MasterKeyMaterial() *Material {
	return &Material{
		PasswordSalt:      u.passwordSalt,
		PasswordNonce:     u.passwordNonce,
		PasswordMasterKey: u.passwordMasterKey,
		RecoverySalt:      u.recoverySalt,
		RecoveryNonce:     u.recoveryNonce,
		RecoveryMasterKey: u.recoveryMasterKey,
	}
}

// DBCredentials is the plaintext database configuration for one account. It is
// serialized to JSON, dual-encrypted (password-KEK + recovery-KEK) and stored
// in the OS keyring; only the encrypted blob ever persists. The password is
// stored here too (it is needed to open the connection at login) but is never
// exposed to the frontend.
type DBCredentials struct {
	Type     dbclient.Dialect `json:"Type"`
	Path     string           `json:"Path,omitempty"`
	Host     string           `json:"Host,omitempty"`
	Port     int              `json:"Port,omitempty"`
	Database string           `json:"Database,omitempty"`
	Username string           `json:"Username,omitempty"`
	Password string           `json:"Password,omitempty"`
}

// ToConfig converts the stored credentials into a client config usable with
// dbclient.NewClient / dbclient.Validate.
func (d DBCredentials) ToConfig() dbclient.Config {
	return dbclient.Config{
		Type:     d.Type,
		Path:     d.Path,
		Host:     d.Host,
		Port:     d.Port,
		Database: d.Database,
		Username: d.Username,
		Password: d.Password,
	}
}

// FromConfig builds stored credentials from a client config.
func FromConfig(c dbclient.Config) DBCredentials {
	return DBCredentials{
		Type:     c.Type,
		Path:     c.Path,
		Host:     c.Host,
		Port:     c.Port,
		Database: c.Database,
		Username: c.Username,
		Password: c.Password,
	}
}

// Storage identifies where a user's encrypted master-key material is kept. It
// is derived from the OS keyring: a keyring entry exists => keyring storage, no
// entry => database storage. The frontend toggles between the two, and the auth
// service migrates the material (and junk-fills / deletes the other source)
// accordingly.
type Storage string

const (
	// StorageDatabase keeps the encrypted master-key material in the users
	// table. It is the default and requires no keyring entry.
	StorageDatabase Storage = "database"
	// StorageKeyring keeps the encrypted master-key material in the OS keyring
	// under "ayo"/"mkey_{username}". When active, the users table columns hold
	// random junk so a stolen database exposes no real key material.
	StorageKeyring Storage = "keyring"
)

// Material is the complete set of values needed to unwrap the master key: the
// salt, nonce and GCM ciphertext for both the password-derived and
// recovery-key-derived KEKs. It mirrors the six users table columns and is what
// gets moved between the database and the OS keyring.
type Material struct {
	PasswordSalt      []byte
	PasswordNonce     []byte
	PasswordMasterKey []byte
	RecoverySalt      []byte
	RecoveryNonce     []byte
	RecoveryMasterKey []byte
}
