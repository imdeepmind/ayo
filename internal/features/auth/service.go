package auth

import (
	"context"
	stderrors "errors"
	"path/filepath"
	"regexp"

	dbclient "ayo/internal/clients/db"
	"ayo/internal/features/dbconfig"
	"ayo/internal/shared/crypto"
	"ayo/internal/shared/errors"
	"ayo/internal/shared/paths"

	"github.com/go-playground/validator/v10"
	"golang.org/x/crypto/bcrypt"
)

// Session holds the in-memory state of the currently signed-in user. It is the
// desktop-app equivalent of an auth cookie: it only exists for the lifetime of
// the running process and is lost on app restart (the frontend re-checks it on
// startup via GetSession).
//
// MasterKey is the decrypted key that encrypts all of the user's data. It is
// kept alongside the session so services like settings can encrypt/decrypt
// without re-deriving it from the password.
//
// The user's database configuration is deliberately NOT stored here: Session is
// serialized to the frontend via GetSession, and exposing the PostgreSQL
// password would leak it to the webview. The config lives on the Service
// (unexported) and is only exposed in sanitized form via DatabaseConfig.
type Session struct {
	UserId    int64
	Username  string
	MasterKey []byte
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
	conn     *dbclient.Connection
	dbCreds  dbconfig.Repository
	repo     Repository
	session  *Session
	dbConfig dbclient.Config
	validate *validator.Validate
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
// keyring repository and a validator with the custom password strength rule
// into a ready-to-use auth Service.
func NewService(conn *dbclient.Connection, dbCreds dbconfig.Repository) *Service {
	validate := validator.New()

	// Register custom password strength validator
	_ = validate.RegisterValidation("password_strength", validatePasswordStrength)

	return &Service{
		conn:     conn,
		dbCreds:  dbCreds,
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
	if err := validateDBConfig(input.DBConfig); err != nil {
		return nil, err
	}

	// Registration targets the new user's own database, which would disconnect
	// any active session. Refuse while signed in.
	if s.session != nil {
		return nil, errors.ErrInvalidInput
	}

	config, err := resolveSQLitePath(input.DBConfig, input.Username)
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

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.AsInternalServerError("register: hash password", err)
	}

	hashedRecoveryKey, err := bcrypt.GenerateFromPassword([]byte(recoveryKey), bcrypt.DefaultCost)
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

	// encrypt master key with password
	passwordKek := crypto.DeriveKEK(input.Password, passwordSalt)
	passwordEncryptedMasterKey, passwordNonce, err := crypto.EncryptMasterKey(passwordKek, masterKey)
	if err != nil {
		return nil, errors.AsInternalServerError("register: encrypt master key with password", err)
	}

	// encrypt master key with recovery key
	recoveryKek := crypto.DeriveKEK(recoveryKey, recoverySalt)
	recoveryEncryptedMasterKey, recoveryNonce, err := crypto.EncryptMasterKey(recoveryKek, masterKey)
	if err != nil {
		return nil, errors.AsInternalServerError("register: encrypt master key with recovery key", err)
	}

	// Dual-encrypt the database credentials and persist them in the keyring so
	// login can re-open the user's database and reset can re-wrap them.
	creds := dbconfig.FromConfig(config)
	encryptedCreds, err := dbconfig.EncryptDBCredentials(input.Password, recoveryKey, creds)
	if err != nil {
		return nil, errors.AsInternalServerError("register: encrypt database credentials", err)
	}
	if err := s.dbCreds.Save(input.Username, encryptedCreds); err != nil {
		return nil, errors.AsInternalServerError("register: save database credentials", err)
	}

	// creating the user
	user, err := s.repo.CreateUser(
		context.Background(),
		input.Username,
		string(hashedPassword),
		string(hashedRecoveryKey),
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

	// return the original recovery key to the user so they can store it
	return &RegisterResult{User: user, RecoveryKey: recoveryKey}, nil
}

// Login verifies the password, unwraps the master key with the password-derived
// KEK, opens the user's database and stores the resulting session in memory. A
// session is not persisted, so the user must log in again after every app
// restart.
func (s *Service) Login(input LoginInput) (bool, error) {
	if err := s.validate.Struct(input); err != nil {
		return false, errors.ErrInvalidInput
	}

	// Load the user's encrypted database credentials from the keyring. A
	// missing entry means no such account exists.
	blob, err := s.dbCreds.Load(input.Username)
	if err != nil {
		if stderrors.Is(err, dbconfig.ErrCredentialsNotFound) {
			return false, errors.ErrUserNotFound
		}
		return false, errors.AsInternalServerError("login: load database credentials", err)
	}

	// Decrypt the credentials with the password-derived KEK. A wrong password
	// fails GCM authentication, which maps to the same user-facing error as the
	// bcrypt check below.
	creds, err := dbconfig.DecryptDBCredentials(input.Password, blob)
	if err != nil {
		return false, errors.ErrInvalidPassword
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

	// comparing the password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		s.conn.Close()
		return false, errors.ErrInvalidPassword
	}

	// salt for the password
	salt := user.PasswordSalt

	// derriving the kek
	kek := crypto.DeriveKEK(input.Password, salt)

	// decrypting the master key
	masterKey, err := crypto.DecryptMasterKey(kek, user.PasswordMasterKey, user.PasswordNonce)
	if err != nil {
		s.conn.Close()
		return false, errors.AsInternalServerError("login: decrypt master key", err)
	}

	// session of the app
	s.session = &Session{
		UserId:    user.ID,
		Username:  user.Username,
		MasterKey: masterKey,
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

	blob, err := s.dbCreds.Load(input.Username)
	if err != nil {
		if stderrors.Is(err, dbconfig.ErrCredentialsNotFound) {
			return nil, errors.ErrUserNotFound
		}
		return nil, errors.AsInternalServerError("reset password: load database credentials", err)
	}

	// The recovery key unwraps both the master key and the database credentials.
	creds, err := dbconfig.DecryptDBCredentialsWithRecovery(input.RecoveryKey, blob)
	if err != nil {
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

	if err := bcrypt.CompareHashAndPassword([]byte(user.RecoveryKey), []byte(input.RecoveryKey)); err != nil {
		s.conn.Close()
		return nil, errors.ErrInvalidRecoveryKey
	}

	// generate new recovery key
	newRecoveryKey, err := crypto.GenerateRecoveryKey()
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: generate recovery key", err)
	}

	// hash the new password to store
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: hash password", err)
	}

	// hash the new recovery key to store
	hashedRecoveryKey, err := bcrypt.GenerateFromPassword([]byte(newRecoveryKey), bcrypt.DefaultCost)
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: hash recovery key", err)
	}

	// extract the original master key using the provided recovery key
	recoveryKek := crypto.DeriveKEK(input.RecoveryKey, user.RecoverySalt)
	masterKey, err := crypto.DecryptMasterKey(recoveryKek, user.RecoveryMasterKey, user.RecoveryNonce)
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: decrypt master key", err)
	}

	// generate the new encrypted master key using password
	passwordKek := crypto.DeriveKEK(input.NewPassword, user.PasswordSalt)
	passwordEncryptedMasterKey, passwordNonce, err := crypto.EncryptMasterKey(passwordKek, masterKey)
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: encrypt master key with password", err)
	}

	// generate the new encrypted master key using recovery key
	recoveryKek = crypto.DeriveKEK(newRecoveryKey, user.RecoverySalt)
	recoveryEncryptedMasterKey, recoveryNonce, err := crypto.EncryptMasterKey(recoveryKek, masterKey)
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: encrypt master key with recovery key", err)
	}

	// update the password and recovery key
	err = s.repo.UpdateUserPassword(
		context.Background(),
		user.ID,
		string(hashedPassword),
		string(hashedRecoveryKey),
		passwordEncryptedMasterKey,
		passwordNonce,
		recoveryEncryptedMasterKey,
		recoveryNonce,
	)
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: update user", err)
	}

	// Re-encrypt the database credentials with the new password and recovery
	// key so the account keeps its database.
	encryptedCreds, err := dbconfig.EncryptDBCredentials(input.NewPassword, newRecoveryKey, creds)
	if err != nil {
		s.conn.Close()
		return nil, errors.AsInternalServerError("reset password: re-encrypt database credentials", err)
	}
	if err := s.dbCreds.Save(input.Username, encryptedCreds); err != nil {
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

	return &RegisterResult{User: user, RecoveryKey: newRecoveryKey}, nil
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
// read-only database display.
func (s *Service) DatabaseConfig() (dbclient.Config, error) {
	if s.session == nil {
		return dbclient.Config{}, errors.ErrUnauthorized
	}
	return s.dbConfig, nil
}

// validateDBConfig enforces type-specific field requirements on the chosen
// database configuration.
func validateDBConfig(config dbclient.Config) error {
	switch config.Type {
	case dbclient.SQLite:
		return nil // the SQLite path is auto-generated
	case dbclient.PostgreSQL:
		if config.Host == "" || config.Port == 0 || config.Database == "" ||
			config.Username == "" || config.Password == "" {
			return errors.ErrInvalidInput
		}
		return nil
	default:
		return errors.ErrInvalidInput
	}
}

// resolveSQLitePath fills in the app-data-directory path for SQLite databases
// when the caller did not supply one, producing "{AppDataDir}/ayo/<username>.db".
func resolveSQLitePath(config dbclient.Config, username string) (dbclient.Config, error) {
	if config.Type != dbclient.SQLite || config.Path != "" {
		return config, nil
	}
	dir, err := paths.GetAppDataDir()
	if err != nil {
		return config, err
	}
	config.Path = filepath.Join(dir, username+".db")
	return config, nil
}
