package auth

import (
	"context"
	stderrors "errors"
	"os"
	"regexp"

	dbclient "ayo/internal/clients/db"
	"ayo/internal/shared/crypto"
	"ayo/internal/shared/dialog"
	"ayo/internal/shared/errors"

	"github.com/go-playground/validator/v10"
)

// Session holds the in-memory state of the currently signed-in user. It is the
// desktop-app equivalent of an auth cookie: it only exists for the lifetime of
// the running process and is lost on app restart (the frontend re-checks it on
// startup via GetSession).
//
// masterKey is the decrypted key that encrypts all of the user's data. It is
// kept alongside the session so services like settings can encrypt/decrypt
// without re-deriving it from the password, and is exposed to them via the
// MasterKey method. It is deliberately unexported: Session is serialized to the
// frontend via GetSession/RequireSession, and the plaintext master key must
// never reach the webview (Wails only serializes exported fields).
//
// The user's database configuration is deliberately NOT stored here: Session is
// serialized to the frontend via GetSession, and exposing the PostgreSQL
// password would leak it to the webview. The config lives on the Service
// (unexported) and is only exposed in sanitized form via DatabaseConfig.
type Session struct {
	UserId    int64
	Username  string
	masterKey []byte
}

// MasterKey returns the session's decrypted 32-byte master key. It is how
// other services access the key without it ever being serialized to the
// frontend.
func (s *Session) MasterKey() []byte {
	return s.masterKey
}

// Service implements the auth business logic and is the single source of truth
// for the current session. It is bound to the frontend via Wails, so every
// exported method is callable from JavaScript.
//
// Each account has its own database. The Service owns the shared
// dbclient.Connection: it opens (and stores) the signed-in user's database on
// login, and closes it on logout. Repositories for queue/upload share the same
// connection and therefore serve whichever user is active.
//
// Methods return user-facing sentinel errors from ayo/internal/shared/errors
// rather than wrapped fmt errors. Internal causes are logged via slog and
// replaced with the vague *errors.InternalServerError so that no implementation
// detail ever leaks to the UI.
type Service struct {
	ctx      context.Context
	conn     *dbclient.Connection
	repo     Repository
	session  *Session
	dbConfig dbclient.Config
	validate *validator.Validate
}

// Startup stores the Wails application context, which native dialogs (e.g.
// SaveRecoveryKey) require.
func (s *Service) Startup(ctx context.Context) {
	s.ctx = ctx
}

// validatePasswordStrength enforces that a password contains at least one
// uppercase letter, one lowercase letter, one digit and one symbol. It is
// registered as the "password_strength" validator rule.
func validatePasswordStrength(fl validator.FieldLevel) bool {
	password := fl.Field().String()

	// Check for at least one uppercase letter
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(password)
	// Check for at least one lowercase letter
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(password)
	// Check for at least one digit
	hasDigit := regexp.MustCompile(`[0-9]`).MatchString(password)
	// Check for at least one special character
	hasSymbol := regexp.MustCompile(`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]`).MatchString(password)

	return hasUpper && hasLower && hasDigit && hasSymbol
}

// NewService wires a shared connection holder, the database-credentials
// keyring repository, the master-key keyring repository and a validator with
// the custom password strength rule into a ready-to-use auth Service.
func NewService(conn *dbclient.Connection) *Service {
	validate := validator.New()

	// Register custom password strength validator
	_ = validate.RegisterValidation("password_strength", validatePasswordStrength)

	return &Service{
		conn:     conn,
		repo:     NewRepository(conn),
		validate: validate,
	}
}

// Register creates a new account, its master key and its own database. The key
// is wrapped twice - once with a KEK derived from the password and once with a
// KEK derived from a freshly generated recovery key - so that a forgotten
// password can be reset later without losing any encrypted data. The chosen
// database configuration is validated up front (the PostgreSQL server is pinged
// or the SQLite location is writable), then the credentials are dual-encrypted
// and persisted in the OS keyring. The plaintext recovery key is returned (and
// must be shown to the user) exactly once.
func (s *Service) Register(input RegisterInput) (*RegisterResult, error) {
	if err := s.validate.Struct(input); err != nil {
		return nil, errors.ErrInvalidInput
	}
	if err := dbclient.ValidateConfig(input.DBConfig); err != nil {
		return nil, err
	}

	// Registration targets the new user's own database, which would disconnect
	// any active session. Refuse while signed in.
	if s.session != nil {
		return nil, errors.ErrInvalidInput
	}

	// Reject usernames already taken on this machine: every registered account
	// has a database-credentials entry in the OS keyring (dbcreds_{username})
	// that is never deleted. Without this check, registering the same username
	// against a different database would silently overwrite the existing
	// account's keyring entry.
	exists, err := s.repo.CredentialsExists(input.Username)
	if err != nil {
		return nil, errors.AsInternalServerError("register: check keychain for existing account", err)
	}
	if exists {
		return nil, errors.ErrUserAlreadyExists
	}

	config, err := dbclient.ResolveSQLitePath(input.DBConfig, input.Username)
	if err != nil {
		return nil, errors.AsInternalServerError("register: resolve sqlite path", err)
	}

	// Ping the database before creating anything, so bad PostgreSQL credentials
	// are reported to the user immediately rather than failing later.
	if err := dbclient.Validate(config); err != nil {
		return nil, errors.ErrDatabaseUnavailable
	}

	client, err := dbclient.NewClient(config)
	if err != nil {
		return nil, errors.ErrDatabaseUnavailable
	}
	s.conn.Set(client)
	// Registration does not sign the user in, so the temporary connection is
	// always closed before returning.
	defer s.conn.Close()

	// Reject duplicate usernames up front: the users table lives in the target
	// database, which is now connected.
	_, err = s.repo.GetUserByUsername(context.Background(), input.Username)
	if err == nil {
		return nil, errors.ErrUserAlreadyExists
	}
	if !stderrors.Is(err, errors.ErrUserNotFound) {
		return nil, errors.AsInternalServerError("register: check existing user", err)
	}

	recoveryKey, err := crypto.GenerateRecoveryKey()
	if err != nil {
		return nil, errors.AsInternalServerError("register: generate recovery key", err)
	}
	defer crypto.Wipe(recoveryKey)

	passwordBytes := []byte(input.Password)
	defer crypto.Wipe(passwordBytes)

	hashedPassword, err := crypto.HashPassword(passwordBytes)
	if err != nil {
		return nil, errors.AsInternalServerError("register: hash password", err)
	}

	hashedRecoveryKey, err := crypto.HashPassword(recoveryKey)
	if err != nil {
		return nil, errors.AsInternalServerError("register: hash recovery key", err)
	}

	// Generate passwordSalt
	passwordSalt, err := crypto.GenerateSalt()
	if err != nil {
		return nil, errors.AsInternalServerError("register: generate password salt", err)
	}

	// Generate recoverySalt
	recoverySalt, err := crypto.GenerateSalt()
	if err != nil {
		return nil, errors.AsInternalServerError("register: generate recovery salt", err)
	}

	// generating a master key
	masterKey, err := crypto.GenerateMasterKey()
	if err != nil {
		return nil, errors.AsInternalServerError("register: generate master key", err)
	}
	// Registration does not create a session, so the master key is transient
	// and must be scrubbed once the wrapped copies are produced.
	defer crypto.Wipe(masterKey)

	// encrypt master key with password
	passwordKek := crypto.DeriveKEK(passwordBytes, passwordSalt)
	defer crypto.Wipe(passwordKek)
	passwordEncryptedMasterKey, passwordNonce, err := crypto.EncryptMasterKey(passwordKek, masterKey)
	if err != nil {
		return nil, errors.AsInternalServerError("register: encrypt master key with password", err)
	}

	// encrypt master key with recovery key
	recoveryKek := crypto.DeriveKEK(recoveryKey, recoverySalt)
	defer crypto.Wipe(recoveryKek)
	recoveryEncryptedMasterKey, recoveryNonce, err := crypto.EncryptMasterKey(recoveryKek, masterKey)
	if err != nil {
		return nil, errors.AsInternalServerError("register: encrypt master key with recovery key", err)
	}

	// Dual-encrypt the database credentials and persist them in the keyring so
	// login can re-open the user's database and reset can re-wrap them.
	creds := FromConfig(config)
	if err := s.repo.SaveCredentials(input.Username, passwordBytes, recoveryKey, creds); err != nil {
		return nil, errors.AsInternalServerError("register: save database credentials", err)
	}

	// creating the user
	user, err := s.repo.CreateUser(
		context.Background(),
		input.Username,
		hashedPassword,
		hashedRecoveryKey,
		passwordSalt,
		passwordNonce,
		passwordEncryptedMasterKey,
		recoverySalt,
		recoveryNonce,
		recoveryEncryptedMasterKey,
	)
	if err != nil {
		if stderrors.Is(err, errors.ErrUserAlreadyExists) {
			return nil, err
		}
		return nil, errors.AsInternalServerError("register: create user", err)
	}

	// return the original recovery key to the user so they can store it. The
	// []byte buffer is wiped on the way out; this string conversion is the one
	// immutable copy Wails needs for serialization.
	return &RegisterResult{User: user, RecoveryKey: string(recoveryKey)}, nil
}

// Login verifies the password, unwraps the master key with the password-derived
// KEK, opens the user's database and stores the resulting session in memory. A
// session is not persisted, so the user must log in again after every app
// restart.
func (s *Service) Login(input LoginInput) (bool, error) {
	if err := s.validate.Struct(input); err != nil {
		return false, errors.ErrInvalidInput
	}

	passwordBytes := []byte(input.Password)
	defer crypto.Wipe(passwordBytes)

	// Load and decrypt the user's database credentials with the password-derived
	// KEK. A missing keyring entry means no such account exists; a wrong password
	// fails GCM authentication, which maps to the same user-facing error as the
	// password-hash check below.
	creds, err := s.repo.LoadCredentials(input.Username, passwordBytes, true)
	if err != nil {
		if stderrors.Is(err, ErrCredentialsNotFound) {
			return false, errors.ErrUserNotFound
		}
		return false, errors.AsInternalServerError("login: load database credentials", err)
	}
	config := creds.ToConfig()

	// Connect to the user's database before touching its tables.
	client, err := dbclient.NewClient(config)
	if err != nil {
		return false, errors.ErrDatabaseUnavailable
	}
	s.conn.Set(client)

	user, err := s.repo.GetUserByUsername(context.Background(), input.Username)
	if err != nil {
		s.conn.Close()
		if stderrors.Is(err, errors.ErrUserNotFound) {
			return false, errors.ErrUserNotFound
		}
		return false, errors.AsInternalServerError("login: get user", err)
	}

	// comparing the password against the stored Argon2id PHC hash
	ok, err := crypto.VerifyPasswordHash(passwordBytes, user.passwordHash)
	if err != nil || !ok {
		s.conn.Close()
		return false, errors.ErrInvalidPassword
	}

	// Load the encrypted master-key material from whichever source it lives in
	// (the OS keyring when an entry exists, otherwise the users table).
	material, err := s.loadMasterKeyMaterial(user)
	if err != nil {
		s.conn.Close()
		return false, errors.AsInternalServerError("login: load master key material", err)
	}

	// deriving the KEK from the password and the stored salt
	kek := crypto.DeriveKEK(passwordBytes, material.PasswordSalt)
	// The KEK is only needed to unwrap the master key; scrub it afterwards.
	defer crypto.Wipe(kek)

	// decrypting the master key
	masterKey, err := crypto.DecryptMasterKey(kek, material.PasswordMasterKey, material.PasswordNonce)
	if err != nil {
		s.conn.Close()
		return false, errors.AsInternalServerError("login: decrypt master key", err)
	}

	// session of the app
	s.session = &Session{
		UserId:    user.ID,
		Username:  user.Username,
		masterKey: masterKey,
	}
	s.dbConfig = config

	return true, nil
}

// ResetPassword lets a user who forgot their password regain access by proving
// ownership of the recovery key. The existing master key is unwrapped with the
// recovery-key-derived KEK (so no data is lost), then re-wrapped with the new
// password and a brand-new recovery key. The database credentials are likewise
// unwrapped with the recovery key and re-encrypted with the new keys, so the
// account keeps its database. The new recovery key is returned and must be
// shown to the user exactly once.
func (s *Service) ResetPassword(input ResetPasswordInput) (*RegisterResult, error) {
	if err := s.validate.Struct(input); err != nil {
		return nil, errors.ErrInvalidInput
	}

	recoveryKeyBytes := []byte(input.RecoveryKey)
	defer crypto.Wipe(recoveryKeyBytes)
	newPasswordBytes := []byte(input.NewPassword)
	defer crypto.Wipe(newPasswordBytes)

	// The recovery key unwraps both the master key and the database credentials.
	// A missing keyring entry means no such account exists.
	creds, err := s.repo.LoadCredentials(input.Username, recoveryKeyBytes, false)
	if err != nil {
		if stderrors.Is(err, ErrCredentialsNotFound) {
			return nil, errors.ErrUserNotFound
		}
		return nil, errors.ErrInvalidRecoveryKey
	}
	config := creds.ToConfig()

	// Remember an active session so its connection can be re-established after
	// the reset (which temporarily takes over the shared connection).
	var restore *dbclient.Config
	if s.session != nil {
		c := s.dbConfig
		restore = &c
	}

	client, err := dbclient.NewClient(config)
	if err != nil {
		return nil, errors.ErrDatabaseUnavailable
	}
	s.conn.Set(client)

	user, err := s.repo.GetUserByUsername(context.Background(), input.Username)
	if err != nil {
		s.conn.Close()
		if stderrors.Is(err, errors.ErrUserNotFound) {
			return nil, errors.ErrUserNotFound
		}
		return nil, errors.AsInternalServerError("reset password: get user", err)
	}

	// Verify the recovery key against the stored Argon2id PHC hash.
	ok, err := crypto.VerifyPasswordHash(recoveryKeyBytes, user.recoveryKey)
	if err != nil || !ok {
		s.conn.Close()
		return nil, errors.ErrInvalidRecoveryKey
	}

	// generate new recovery key
	newRecoveryKey, err := crypto.GenerateRecoveryKey()
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: generate recovery key", err)
	}
	defer crypto.Wipe(newRecoveryKey)

	// hash the new password to store
	hashedPassword, err := crypto.HashPassword(newPasswordBytes)
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: hash password", err)
	}

	// hash the new recovery key to store
	hashedRecoveryKey, err := crypto.HashPassword(newRecoveryKey)
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: hash recovery key", err)
	}

	// Load the encrypted master-key material from whichever source it lives in
	// (the OS keyring when an entry exists, otherwise the users table).
	material, err := s.loadMasterKeyMaterial(user)
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: load master key material", err)
	}

	// extract the original master key using the provided recovery key
	recoveryKek := crypto.DeriveKEK(recoveryKeyBytes, material.RecoverySalt)
	masterKey, err := crypto.DecryptMasterKey(recoveryKek, material.RecoveryMasterKey, material.RecoveryNonce)
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: decrypt master key", err)
	}
	// This KEK is reassigned below, so scrub it now rather than deferring.
	crypto.Wipe(recoveryKek)
	// Reset does not sign the user in, so the unwrapped master key is transient
	// and must be scrubbed once the re-wrapped copies are produced.
	defer crypto.Wipe(masterKey)

	// generate the new encrypted master key using password
	passwordKek := crypto.DeriveKEK(newPasswordBytes, material.PasswordSalt)
	defer crypto.Wipe(passwordKek)
	passwordEncryptedMasterKey, passwordNonce, err := crypto.EncryptMasterKey(passwordKek, masterKey)
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: encrypt master key with password", err)
	}

	// generate the new encrypted master key using recovery key
	recoveryKek = crypto.DeriveKEK(newRecoveryKey, material.RecoverySalt)
	recoveryEncryptedMasterKey, recoveryNonce, err := crypto.EncryptMasterKey(recoveryKek, masterKey)
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: encrypt master key with recovery key", err)
	}
	crypto.Wipe(recoveryKek)

	// update the password and recovery key hashes
	err = s.repo.UpdateUserHashes(
		context.Background(),
		user.ID,
		hashedPassword,
		hashedRecoveryKey,
	)
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: update user", err)
	}

	// Re-wrap the master key in whichever source it lives in, so an account that
	// stores its material in the keyring keeps the real values there while its
	// users table columns stay junk, and vice versa.
	material.PasswordNonce = passwordNonce
	material.PasswordMasterKey = passwordEncryptedMasterKey
	material.RecoveryNonce = recoveryNonce
	material.RecoveryMasterKey = recoveryEncryptedMasterKey
	if err := s.persistMasterKeyMaterial(context.Background(), user, material); err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: update master key material", err)
	}

	// Re-encrypt the database credentials with the new password and recovery
	// key so the account keeps its database.
	if err := s.repo.SaveCredentials(input.Username, newPasswordBytes, newRecoveryKey, creds); err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: save database credentials", err)
	}

	// Release the temporary connection and re-establish any previous session's
	// database connection.
	s.conn.Close()
	if restore != nil {
		if c, err := dbclient.NewClient(*restore); err == nil {
			s.conn.Set(c)
		}
	}

	// The []byte buffer is wiped on the way out; this string conversion is the
	// one immutable copy Wails needs for serialization.
	return &RegisterResult{User: user, RecoveryKey: string(newRecoveryKey)}, nil
}

// Logout clears the in-memory session and closes the user's database
// connection, ending the current user's access.
func (s *Service) Logout() {
	s.session = nil
	s.dbConfig = dbclient.Config{}
	s.conn.Close()
}

// GetSession returns the current in-memory session, or nil when signed out.
func (s *Service) GetSession() *Session {
	return s.session
}

// RequireSession returns the current session or ErrUnauthorized. It is the
// de-facto auth guard used by other services (e.g. settings) to gate access to
// signed-in-only operations.
func (s *Service) RequireSession() (*Session, error) {
	if s.session == nil {
		return nil, errors.ErrUnauthorized
	}
	return s.session, nil
}

// CurrentClient returns the signed-in user's active database connection, or
// ErrUnauthorized when signed out. Other DB-backed services use it to resolve
// the active client's dialect/connection when needed.
func (s *Service) CurrentClient() (*dbclient.Client, error) {
	if s.session == nil {
		return nil, errors.ErrUnauthorized
	}
	return s.conn.Current()
}

// DatabaseConfig returns the signed-in user's database configuration, or
// ErrUnauthorized when signed out. Used by the settings service for the
// read-only database display. The password is stripped before returning so the
// Wails-bound method can never leak it to the webview.
func (s *Service) DatabaseConfig() (dbclient.Config, error) {
	if s.session == nil {
		return dbclient.Config{}, errors.ErrUnauthorized
	}
	config := s.dbConfig
	config.Password = ""
	return config, nil
}

// GetMasterKeyStorage reports where the signed-in user's encrypted master-key
// material is kept: "keyring" when an entry exists in the OS keyring, otherwise
// "database" (the users table). It requires a signed-in session.
func (s *Service) GetMasterKeyStorage() (string, error) {
	if _, err := s.RequireSession(); err != nil {
		return "", err
	}
	storage, err := s.masterKeyStorage(s.session.Username)
	if err != nil {
		return "", errors.AsInternalServerError("get master key storage", err)
	}
	return string(storage), nil
}

// SetMasterKeyStorage migrates the signed-in user's encrypted master-key
// material to the requested source ("keyring" or "database"). Both the
// password- and recovery-key-derived salt, nonce and ciphertext are copied to
// the target, and the source is cleared: the users table columns are filled
// with random junk when moving to the keyring, and the keyring entry is deleted
// when moving to the database. It returns the resulting storage state.
func (s *Service) SetMasterKeyStorage(storage string) (string, error) {
	if _, err := s.RequireSession(); err != nil {
		return "", err
	}
	target := Storage(storage)
	if target != StorageDatabase && target != StorageKeyring {
		return "", errors.ErrInvalidInput
	}

	current, err := s.masterKeyStorage(s.session.Username)
	if err != nil {
		return "", errors.AsInternalServerError("set master key storage: read state", err)
	}
	if target == current {
		return string(current), nil
	}

	user, err := s.repo.GetUserByUsername(context.Background(), s.session.Username)
	if err != nil {
		return "", errors.AsInternalServerError("set master key storage: get user", err)
	}

	// The material currently lives in the source we are migrating away from.
	material, err := s.loadMasterKeyMaterial(user)
	if err != nil {
		return "", errors.AsInternalServerError("set master key storage: load material", err)
	}

	if target == StorageKeyring {
		// Move the real material into the keyring and fill the database columns
		// with indistinguishable random junk.
		if err := s.repo.SaveMasterKeyKeyring(s.session.Username, material); err != nil {
			return "", errors.AsInternalServerError("set master key storage: save to keyring", err)
		}
		junk, err := GenerateJunk()
		if err != nil {
			return "", errors.AsInternalServerError("set master key storage: generate junk", err)
		}
		if err := s.repo.UpdateMasterKeyMaterial(context.Background(), user.ID, junk); err != nil {
			return "", errors.AsInternalServerError("set master key storage: junk database", err)
		}
	} else {
		// Restore the real material into the database and drop the keyring
		// entry so the state stays detectable from the keyring alone.
		if err := s.repo.UpdateMasterKeyMaterial(context.Background(), user.ID, material); err != nil {
			return "", errors.AsInternalServerError("set master key storage: restore database", err)
		}
		if err := s.repo.DeleteMasterKeyKeyring(s.session.Username); err != nil {
			return "", errors.AsInternalServerError("set master key storage: delete keyring", err)
		}
	}

	return string(target), nil
}

// masterKeyStorage reports whether a keyring entry exists for the user. It is
// the single source of truth for the storage state: present => keyring storage,
// absent => database storage.
func (s *Service) masterKeyStorage(username string) (Storage, error) {
	exists, err := s.repo.MasterKeyKeyringExists(username)
	if err != nil {
		return "", err
	}
	if exists {
		return StorageKeyring, nil
	}
	return StorageDatabase, nil
}

// loadMasterKeyMaterial returns a user's encrypted master-key material from
// whichever source it currently lives in: the OS keyring when an entry exists,
// otherwise the users table row.
func (s *Service) loadMasterKeyMaterial(user *User) (*Material, error) {
	exists, err := s.repo.MasterKeyKeyringExists(user.Username)
	if err != nil {
		return nil, err
	}
	if exists {
		return s.repo.LoadMasterKeyKeyring(user.Username)
	}
	return user.MasterKeyMaterial(), nil
}

// persistMasterKeyMaterial writes the encrypted master-key material to the
// source it is currently stored in (the OS keyring when an entry exists,
// otherwise the users table). The other source is left untouched, so the
// keyring entry and the database junk stay consistent for keyring-stored
// accounts.
func (s *Service) persistMasterKeyMaterial(ctx context.Context, user *User, material *Material) error {
	exists, err := s.repo.MasterKeyKeyringExists(user.Username)
	if err != nil {
		return err
	}
	if exists {
		return s.repo.SaveMasterKeyKeyring(user.Username, material)
	}
	return s.repo.UpdateMasterKeyMaterial(ctx, user.ID, material)
}

// SaveRecoveryKey opens a save file dialog and writes the recovery key to the
// selected location. It is the frontend-facing counterpart of the recovery-key
// flow in Register and ResetPassword: after either, the user downloads the key
// so it can be stored somewhere safe. The recovery key is passed in (the user
// is not signed in during these flows), never read from the session.
func (s *Service) SaveRecoveryKey(username, recoveryKey string) error {
	filePath, err := dialog.SaveFile(s.ctx, dialog.Options{
		DefaultFilename:   "recovery-key-" + username + ".txt",
		Title:             "Save Recovery Key",
		FileFilterName:    "Text Files (*.txt)",
		FileFilterPattern: "*.txt",
	})
	if err != nil {
		return err
	}

	// User cancelled the dialog
	if filePath == "" {
		return nil
	}

	// Write the recovery key to the file
	return os.WriteFile(filePath, []byte(recoveryKey), 0600)
}
