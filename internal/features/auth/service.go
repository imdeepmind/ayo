package auth

import (
	"context"
	stderrors "errors"
	"regexp"

	"ayo/internal/shared/crypto"
	"ayo/internal/shared/errors"

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
type Session struct {
	UserId    int64
	Username  string
	MasterKey []byte
}

// Service implements the auth business logic and is the single source of truth
// for the current session. It is bound to the frontend via Wails, so every
// exported method is callable from JavaScript.
//
// Methods return user-facing sentinel errors from ayo/internal/shared/errors rather
// than wrapped fmt errors. Internal causes are logged via slog and replaced
// with the vague *errors.InternalServerError so that no implementation detail
// ever leaks to the UI.
type Service struct {
	session  *Session
	repo     Repository
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

// NewService wires a repository and a validator with the custom password
// strength rule into a ready-to-use auth Service.
func NewService(repo Repository) *Service {
	validate := validator.New()

	// Register custom password strength validator
	_ = validate.RegisterValidation("password_strength", validatePasswordStrength)

	return &Service{
		repo:     repo,
		validate: validate,
	}
}

// Register creates a new account and its master key. The key is wrapped twice -
// once with a KEK derived from the password and once with a KEK derived from a
// freshly generated recovery key - so that a forgotten password can be reset
// later without losing any encrypted data. The plaintext recovery key is
// returned (and must be shown to the user) exactly once.
func (s *Service) Register(input RegisterInput) (*RegisterResult, error) {
	if err := s.validate.Struct(input); err != nil {
		return nil, errors.ErrInvalidInput
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
// KEK, and stores the resulting session in memory. A session is not persisted,
// so the user must log in again after every app restart.
func (s *Service) Login(input LoginInput) (bool, error) {
	if err := s.validate.Struct(input); err != nil {
		return false, errors.ErrInvalidInput
	}

	user, err := s.repo.GetUserByUsername(context.Background(), input.Username)
	if err != nil {
		if stderrors.Is(err, errors.ErrUserNotFound) {
			return false, errors.ErrUserNotFound
		}
		return false, errors.AsInternalServerError("login: get user", err)
	}

	// comparing the password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return false, errors.ErrInvalidPassword
	}

	// salt for the password
	salt := user.PasswordSalt

	// derriving the kek
	kek := crypto.DeriveKEK(input.Password, salt)

	// decrypting the master key
	masterKey, err := crypto.DecryptMasterKey(kek, user.PasswordMasterKey, user.PasswordNonce)
	if err != nil {
		return false, errors.AsInternalServerError("login: decrypt master key", err)
	}

	// session of the app
	s.session = &Session{
		UserId:    user.ID,
		Username:  user.Username,
		MasterKey: masterKey,
	}

	return true, nil
}

// ResetPassword lets a user who forgot their password regain access by proving
// ownership of the recovery key. The existing master key is unwrapped with the
// recovery-key-derived KEK (so no data is lost), then re-wrapped with the new
// password and a brand-new recovery key. The new recovery key is returned and
// must be shown to the user exactly once.
func (s *Service) ResetPassword(input ResetPasswordInput) (*RegisterResult, error) {
	if err := s.validate.Struct(input); err != nil {
		return nil, errors.ErrInvalidInput
	}

	user, err := s.repo.GetUserByUsername(context.Background(), input.Username)
	if err != nil {
		if stderrors.Is(err, errors.ErrUserNotFound) {
			return nil, errors.ErrUserNotFound
		}
		return nil, errors.AsInternalServerError("reset password: get user", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.RecoveryKey), []byte(input.RecoveryKey)); err != nil {
		return nil, errors.ErrInvalidRecoveryKey
	}

	// generate new recovery key
	newRecoveryKey, err := crypto.GenerateRecoveryKey()
	if err != nil {
		return nil, errors.AsInternalServerError("reset password: generate recovery key", err)
	}

	// hash the new password to store
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.AsInternalServerError("reset password: hash password", err)
	}

	// hash the new recovery key to store
	hashedRecoveryKey, err := bcrypt.GenerateFromPassword([]byte(newRecoveryKey), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.AsInternalServerError("reset password: hash recovery key", err)
	}

	// extract the original master key using the provided recovery key
	recoveryKek := crypto.DeriveKEK(input.RecoveryKey, user.RecoverySalt)
	masterKey, err := crypto.DecryptMasterKey(recoveryKek, user.RecoveryMasterKey, user.RecoveryNonce)
	if err != nil {
		return nil, errors.AsInternalServerError("reset password: decrypt master key", err)
	}

	// generate the new encrypted master key using password
	passwordKek := crypto.DeriveKEK(input.NewPassword, user.PasswordSalt)
	passwordEncryptedMasterKey, passwordNonce, err := crypto.EncryptMasterKey(passwordKek, masterKey)
	if err != nil {
		return nil, errors.AsInternalServerError("reset password: encrypt master key with password", err)
	}

	// generate the new encrypted master key using recovery key
	recoveryKek = crypto.DeriveKEK(newRecoveryKey, user.RecoverySalt)
	recoveryEncryptedMasterKey, recoveryNonce, err := crypto.EncryptMasterKey(recoveryKek, masterKey)
	if err != nil {
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
		return nil, errors.AsInternalServerError("reset password: update user", err)
	}

	return &RegisterResult{User: user, RecoveryKey: newRecoveryKey}, nil
}

// Logout clears the in-memory session, ending the current user's access.
func (s *Service) Logout() {
	s.session = nil
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
