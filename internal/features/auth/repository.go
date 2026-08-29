package auth

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	stderrors "errors"
	"fmt"
	"strings"
	"sync"

	dbclient "ayo/internal/clients/db"
	"ayo/internal/platform/keyring"
	"ayo/internal/shared/crypto"
	"ayo/internal/shared/errors"
)

// Repository abstracts persistence for the auth module. It is the only thing
// that touches the database (via internal/clients/db) and the OS keyring (via
// internal/platform/keyring); the service calls the repository and never
// reaches into clients/platform directly. Keeping it behind an interface makes
// the service testable with a fake implementation instead of a real database.
type Repository interface {
	CreateUser(
		ctx context.Context,
		username string,
		passwordHash string,
		recoveryKey string,
		passwordSalt []byte,
		passwordNonce []byte,
		passwordMasterKey []byte,
		recoverySalt []byte,
		recoveryNonce []byte,
		recoveryMasterKey []byte,
	) (*User, error)
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	UpdateUserHashes(
		ctx context.Context,
		id int64,
		passwordHash string,
		recoveryKey string,
	) error
	UpdateMasterKeyMaterial(ctx context.Context, id int64, material *Material) error
	CredentialsExists(username string) (bool, error)
	SaveCredentials(username string, password, recoveryKey []byte, creds DBCredentials) error
	LoadCredentials(username string, secret []byte, fromPassword bool) (DBCredentials, error)
	MasterKeyKeyringExists(username string) (bool, error)
	SaveMasterKeyKeyring(username string, material *Material) error
	LoadMasterKeyKeyring(username string) (*Material, error)
	DeleteMasterKeyKeyring(username string) error
}

type repository struct {
	conn       *dbclient.Connection
	initMu     sync.Mutex
	initClient *dbclient.Client
}

// NewRepository returns a repository bound to the shared connection holder. The
// users table is created lazily on the active client (see resolve), since there
// is no database connection before a user signs in.
func NewRepository(conn *dbclient.Connection) Repository {
	return &repository{conn: conn}
}

// resolve returns the active client for the current session, creating the
// feature's tables on it the first time it is seen. Each user's database is
// initialized once, on first access after login (or registration).
func (r *repository) resolve() (*dbclient.Client, error) {
	c, err := r.conn.Current()
	if err != nil {
		return nil, err
	}
	r.initMu.Lock()
	defer r.initMu.Unlock()
	if r.initClient != c {
		if err := initializeTable(c); err != nil {
			return nil, err
		}
		r.initClient = c
	}
	return c, nil
}

// initializeTable idempotently ensures the users table exists. It stores only
// hashes and encrypted material - never plaintext credentials. Column types use
// BYTEA notation but SQLite is untyped, so []byte values are stored as blobs;
// PostgreSQL stores them in native BYTEA columns. The id column and DDL differ
// per dialect.
func initializeTable(db *dbclient.Client) error {
	idColumn := "id INTEGER PRIMARY KEY AUTOINCREMENT"
	if db.IsPostgres() {
		idColumn = "id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY"
	}

	query := `CREATE TABLE IF NOT EXISTS users (
		` + idColumn + `,
		username VARCHAR(255) NOT NULL UNIQUE,
		password_hash VARCHAR(255) NOT NULL,
		recovery_key VARCHAR(255) NOT NULL,

		password_salt BYTEA NOT NULL,
		password_nonce BYTEA NOT NULL,
		password_master_key BYTEA NOT NULL,

		recovery_salt BYTEA NOT NULL,
		recovery_nonce BYTEA NOT NULL,
		recovery_master_key BYTEA NOT NULL
	)`

	_, err := db.Exec(query)
	if err != nil {
		return err
	}
	return nil
}

// CreateUser inserts a new account row and returns the created User populated
// with its assigned ID. A duplicate username surfaces as ErrUserAlreadyExists.
func (r *repository) CreateUser(
	ctx context.Context,
	username string,
	passwordHash string,
	recoveryKey string,
	passwordSalt []byte,
	passwordNonce []byte,
	passwordMasterKey []byte,
	recoverySalt []byte,
	recoveryNonce []byte,
	recoveryMasterKey []byte,
) (*User, error) {
	query := `INSERT INTO users (username, password_hash, recovery_key, password_salt, ` +
		`password_nonce, password_master_key, recovery_salt, recovery_nonce, ` +
		`recovery_master_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`

	args := []any{
		username, passwordHash, recoveryKey, passwordSalt,
		passwordNonce, passwordMasterKey, recoverySalt, recoveryNonce,
		recoveryMasterKey,
	}

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}

	var id int64
	if client.IsPostgres() {
		// PostgreSQL has no LastInsertId; fetch the assigned ID via RETURNING.
		err := client.QueryRowContext(ctx, client.Rebind(query)+" RETURNING id", args...).Scan(&id)
		if err != nil {
			if strings.Contains(err.Error(), "duplicate key value violates unique constraint") {
				return nil, errors.ErrUserAlreadyExists
			}
			return nil, fmt.Errorf("failed to create user: %w", err)
		}
	} else {
		result, err := client.ExecContext(ctx, client.Rebind(query), args...)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE constraint failed") || strings.Contains(err.Error(), "Duplicate entry") {
				return nil, errors.ErrUserAlreadyExists
			}
			return nil, fmt.Errorf("failed to create user: %w", err)
		}
		id, err = client.LastInsertID(result)
		if err != nil {
			return nil, fmt.Errorf("failed to get last insert id: %w", err)
		}
	}

	user := &User{
		ID:           id,
		Username:     username,
		passwordHash: passwordHash,
		recoveryKey:  recoveryKey,
	}

	return user, nil
}

// GetUserByUsername fetches a user by exact username match. It returns
// ErrUserNotFound when no such account exists.
func (r *repository) GetUserByUsername(ctx context.Context, username string) (*User, error) {
	query := `SELECT id, username, password_hash, recovery_key, password_salt, ` +
		`password_master_key, password_nonce, recovery_salt, recovery_master_key, ` +
		`recovery_nonce FROM users WHERE username = ?`

	client, err := r.resolve()
	if err != nil {
		return nil, err
	}
	row := client.QueryRowContext(ctx, client.Rebind(query), username)

	var user User
	err = row.Scan(
		&user.ID, &user.Username, &user.passwordHash, &user.recoveryKey,
		&user.passwordSalt, &user.passwordMasterKey, &user.passwordNonce,
		&user.recoverySalt, &user.recoveryMasterKey, &user.recoveryNonce,
	)
	if err != nil {
		if stderrors.Is(err, sql.ErrNoRows) {
			return nil, errors.ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return &user, nil
}

// UpdateUserHashes replaces the password and recovery-key Argon2id hashes for
// the given user. Used by the reset-password flow; the encrypted master-key
// material is updated separately (see UpdateMasterKeyMaterial) so that
// keyring-stored accounts keep junk in the database.
func (r *repository) UpdateUserHashes(
	ctx context.Context,
	id int64,
	passwordHash string,
	recoveryKey string,
) error {
	query := `UPDATE users SET password_hash = ?, recovery_key = ? WHERE id = ?`

	client, err := r.resolve()
	if err != nil {
		return err
	}
	_, err = client.ExecContext(
		ctx,
		client.Rebind(query),
		passwordHash, recoveryKey, id,
	)
	if err != nil {
		return fmt.Errorf("failed to update user hashes: %w", err)
	}
	return nil
}

// UpdateMasterKeyMaterial replaces the six encrypted master-key columns for the
// given user. It is used to migrate the material between the users table and
// the OS keyring: when the material moves to the keyring, this writes
// indistinguishable random junk; when it moves back, it writes the real values.
func (r *repository) UpdateMasterKeyMaterial(ctx context.Context, id int64, material *Material) error {
	query := `UPDATE users SET password_salt = ?, password_nonce = ?, ` +
		`password_master_key = ?, recovery_salt = ?, recovery_nonce = ?, ` +
		`recovery_master_key = ? WHERE id = ?`

	client, err := r.resolve()
	if err != nil {
		return err
	}
	_, err = client.ExecContext(
		ctx,
		client.Rebind(query),
		material.PasswordSalt, material.PasswordNonce, material.PasswordMasterKey,
		material.RecoverySalt, material.RecoveryNonce, material.RecoveryMasterKey,
		id,
	)
	if err != nil {
		return fmt.Errorf("failed to update master key material: %w", err)
	}
	return nil
}

// ErrCredentialsNotFound is returned by loadDBCreds when no keyring entry exists
// for the user. It is an internal marker (mapped by the service to
// ErrUserNotFound) rather than a user-facing message.
var ErrCredentialsNotFound = stderrors.New("database credentials not found in keyring")

// CredentialsExists reports whether a database-credentials keyring entry exists
// for the user. It is the machine-level account marker: every registered
// account saves an entry and never deletes it, so its presence means a username
// is already taken on this device.
func (r *repository) CredentialsExists(username string) (bool, error) {
	return dbCredsExists(username)
}

// SaveCredentials serializes creds, dual-encrypts them (password-KEK +
// recovery-KEK) and persists the blob in the OS keyring. password and
// recoveryKey must be mutable copies of the secrets (see crypto.Wipe).
func (r *repository) SaveCredentials(username string, password, recoveryKey []byte, creds DBCredentials) error {
	encrypted, err := encryptDBCreds(password, recoveryKey, creds)
	if err != nil {
		return err
	}
	return saveDBCreds(username, encrypted)
}

// LoadCredentials loads the encrypted database-credentials blob and unwraps it
// with the given secret. fromPassword selects the password-derived KEK (login)
// or the recovery-key-derived KEK (password reset). secret must be a mutable
// copy (see crypto.Wipe). A wrong secret fails GCM authentication and returns
// an error.
func (r *repository) LoadCredentials(username string, secret []byte, fromPassword bool) (DBCredentials, error) {
	blob, err := loadDBCreds(username)
	if err != nil {
		return DBCredentials{}, err
	}
	return decryptDBCreds(secret, blob, fromPassword)
}

// MasterKeyKeyringExists reports whether a master-key keyring entry exists for
// the user. It is the source of truth for the storage state: present => keyring
// storage, absent => database storage.
func (r *repository) MasterKeyKeyringExists(username string) (bool, error) {
	return masterKeyKeyringExists(username)
}

// SaveMasterKeyKeyring replaces the user's encrypted master-key material in the
// OS keyring.
func (r *repository) SaveMasterKeyKeyring(username string, material *Material) error {
	return saveMasterKeyKeyring(username, material)
}

// LoadMasterKeyKeyring returns the user's encrypted master-key material from
// the OS keyring, or ErrMasterKeyNotFound when no entry exists.
func (r *repository) LoadMasterKeyKeyring(username string) (*Material, error) {
	return loadMasterKeyKeyring(username)
}

// DeleteMasterKeyKeyring removes the user's master-key keyring entry. Removing
// an entry that does not exist is not an error.
func (r *repository) DeleteMasterKeyKeyring(username string) error {
	return deleteMasterKeyKeyring(username)
}

// dbCredsKeyringUser maps an account username to the keyring entry holding its
// database credentials, keeping it separate from the "ayo" entries used by
// settings and the "mkey_" entries used by the master-key keyring.
func dbCredsKeyringUser(username string) string {
	return "dbcreds_" + username
}

// loadDBCreds returns the encrypted database-credentials blob for the user, or
// ErrCredentialsNotFound when nothing has been saved yet.
func loadDBCreds(username string) ([]byte, error) {
	encoded, err := keyring.Get("ayo", dbCredsKeyringUser(username))
	if err != nil {
		if keyring.IsNotFound(err) {
			return nil, ErrCredentialsNotFound
		}
		return nil, fmt.Errorf("load database credentials from keyring: %w", err)
	}

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("decode database credentials blob: %w", err)
	}
	return decoded, nil
}

// saveDBCreds replaces the encrypted database-credentials blob for the user.
func saveDBCreds(username string, data []byte) error {
	encoded := base64.StdEncoding.EncodeToString(data)
	if err := keyring.Set("ayo", dbCredsKeyringUser(username), encoded); err != nil {
		return fmt.Errorf("save database credentials to keyring: %w", err)
	}
	return nil
}

// dbCredsExists reports whether a database-credentials entry is stored for the
// user. It is the machine-level account marker: every registered account saves
// an entry and never deletes it, so its presence means a username is already
// taken on this device.
func dbCredsExists(username string) (bool, error) {
	return keyring.Exists("ayo", dbCredsKeyringUser(username))
}

// encryptDBCreds serializes creds and dual-encrypts them (password-KEK +
// recovery-KEK) via crypto.DualEncrypt. password and recoveryKey must be
// mutable copies of the secrets (see crypto.Wipe); the transient plaintext JSON
// is scrubbed before returning.
func encryptDBCreds(password, recoveryKey []byte, creds DBCredentials) ([]byte, error) {
	plaintext, err := json.Marshal(creds)
	if err != nil {
		return nil, err
	}
	defer crypto.Wipe(plaintext)
	return crypto.DualEncrypt(plaintext, password, recoveryKey)
}

// decryptDBCreds unwraps a blob previously produced by encryptDBCreds.
// fromPassword selects the password-derived KEK (login) or the
// recovery-key-derived KEK (password reset). secret must be a mutable copy of
// the secret (see crypto.Wipe); the transient plaintext JSON is scrubbed before
// returning.
func decryptDBCreds(secret []byte, blob []byte, fromPassword bool) (DBCredentials, error) {
	plaintext, err := crypto.DualDecrypt(blob, secret, fromPassword)
	if err != nil {
		return DBCredentials{}, err
	}
	defer crypto.Wipe(plaintext)

	var creds DBCredentials
	if err := json.Unmarshal(plaintext, &creds); err != nil {
		return DBCredentials{}, err
	}
	return creds, nil
}

// ErrMasterKeyNotFound is returned by loadMasterKeyKeyring when no keyring entry
// exists for the user. It signals database storage (see masterKeyKeyringExists).
var ErrMasterKeyNotFound = stderrors.New("master key not found in keyring")

// masterKeyKeyringUser maps an account username to the keyring entry holding its
// encrypted master-key material.
func masterKeyKeyringUser(username string) string {
	return "mkey_" + username
}

// loadMasterKeyKeyring returns the user's encrypted master-key material from the
// OS keyring, or ErrMasterKeyNotFound when no entry exists.
func loadMasterKeyKeyring(username string) (*Material, error) {
	encoded, err := keyring.Get("ayo", masterKeyKeyringUser(username))
	if err != nil {
		if keyring.IsNotFound(err) {
			return nil, ErrMasterKeyNotFound
		}
		return nil, fmt.Errorf("load master key from keyring: %w", err)
	}

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("decode master key blob: %w", err)
	}

	var material Material
	if err := json.Unmarshal(decoded, &material); err != nil {
		return nil, fmt.Errorf("unmarshal master key blob: %w", err)
	}
	return &material, nil
}

// saveMasterKeyKeyring replaces the user's encrypted master-key material in the
// OS keyring.
func saveMasterKeyKeyring(username string, material *Material) error {
	raw, err := json.Marshal(material)
	if err != nil {
		return fmt.Errorf("marshal master key blob: %w", err)
	}
	encoded := base64.StdEncoding.EncodeToString(raw)
	if err := keyring.Set("ayo", masterKeyKeyringUser(username), encoded); err != nil {
		return fmt.Errorf("save master key to keyring: %w", err)
	}
	return nil
}

// deleteMasterKeyKeyring removes the user's master-key keyring entry. Removing
// an entry that does not exist is not an error.
func deleteMasterKeyKeyring(username string) error {
	if err := keyring.Delete("ayo", masterKeyKeyringUser(username)); err != nil {
		return fmt.Errorf("delete master key from keyring: %w", err)
	}
	return nil
}

// masterKeyKeyringExists reports whether a keyring entry is stored for the user.
// It is the source of truth for the storage state: present => keyring storage,
// absent => database storage.
func masterKeyKeyringExists(username string) (bool, error) {
	return keyring.Exists("ayo", masterKeyKeyringUser(username))
}

// GenerateJunk returns a Material filled with random bytes sized like real
// encrypted master-key material. It is written to the users table columns while
// the real material lives in the OS keyring, so a stolen database offers no
// usable key material and the junk is indistinguishable from the real ciphertext
// (same lengths: 16-byte salts, 12-byte nonces, 48-byte wrapped keys).
func GenerateJunk() (*Material, error) {
	bytes := func(n int) ([]byte, error) {
		b := make([]byte, n)
		if _, err := rand.Read(b); err != nil {
			return nil, err
		}
		return b, nil
	}

	passwordSalt, err := bytes(16)
	if err != nil {
		return nil, fmt.Errorf("generate junk password salt: %w", err)
	}
	passwordNonce, err := bytes(12)
	if err != nil {
		return nil, fmt.Errorf("generate junk password nonce: %w", err)
	}
	passwordMasterKey, err := bytes(48)
	if err != nil {
		return nil, fmt.Errorf("generate junk password master key: %w", err)
	}
	recoverySalt, err := bytes(16)
	if err != nil {
		return nil, fmt.Errorf("generate junk recovery salt: %w", err)
	}
	recoveryNonce, err := bytes(12)
	if err != nil {
		return nil, fmt.Errorf("generate junk recovery nonce: %w", err)
	}
	recoveryMasterKey, err := bytes(48)
	if err != nil {
		return nil, fmt.Errorf("generate junk recovery master key: %w", err)
	}

	return &Material{
		PasswordSalt:      passwordSalt,
		PasswordNonce:     passwordNonce,
		PasswordMasterKey: passwordMasterKey,
		RecoverySalt:      recoverySalt,
		RecoveryNonce:     recoveryNonce,
		RecoveryMasterKey: recoveryMasterKey,
	}, nil
}
