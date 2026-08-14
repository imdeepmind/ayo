package masterkey

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
