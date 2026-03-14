package auth

import (
	"context"
	"regexp"

	"ayo/internal/errors"
	"ayo/internal/utils"

	"github.com/go-playground/validator/v10"
	"golang.org/x/crypto/bcrypt"
)

type Session struct {
	UserId    int64
	Username  string
	MasterKey []byte
}

type Service struct {
	session  *Session
	repo     Repository
	validate *validator.Validate
}

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

func NewService(repo Repository) *Service {
	validate := validator.New()

	// Register custom password strength validator
	_ = validate.RegisterValidation("password_strength", validatePasswordStrength)

	return &Service{
		repo:     repo,
		validate: validate,
	}
}

func (s *Service) Register(input RegisterInput) (*User, error) {
	if err := s.validate.Struct(input); err != nil {
		return nil, errors.ErrInvalidInput
	}

	recoveryKey, err := utils.GenerateRecoveryKey()
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	hashedRecoveryKey, err := bcrypt.GenerateFromPassword([]byte(recoveryKey), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// Generate passwordSalt
	passwordSalt, err := utils.GenerateSalt()
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// Generate recoverySalt
	recoverySalt, err := utils.GenerateSalt()
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// generating a master key
	masterKey, err := utils.GenerateMasterKey()
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// encrypt master key with password
	passwordKek := utils.DeriveKEK(input.Password, passwordSalt)
	passwordEncryptedMasterKey, passwordNonce, err := utils.EncryptMasterKey(passwordKek, masterKey)
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// encrypt master key with recovery key
	recoveryKek := utils.DeriveKEK(recoveryKey, recoverySalt)
	recoveryEncryptedMasterKey, recoveryNonce, err := utils.EncryptMasterKey(recoveryKek, masterKey)

	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// creating the user
	user, err := s.repo.CreateUser(context.Background(), input.Username, string(hashedPassword), string(hashedRecoveryKey), passwordSalt, passwordNonce, passwordEncryptedMasterKey, recoverySalt, recoveryNonce, recoveryEncryptedMasterKey)
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// we want to return the original recovery key to the user so user can store it
	user.RecoveryKey = recoveryKey

	return user, nil
}

func (s *Service) Login(input LoginInput) (bool, error) {
	if err := s.validate.Struct(input); err != nil {
		return false, errors.ErrInvalidInput
	}

	user, err := s.repo.GetUserByUsername(context.Background(), input.Username)
	if err != nil {
		return false, errors.ErrInternalServer
	}

	if user == nil {
		return false, errors.ErrUserNotFound
	}

	// comparing the password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return false, errors.ErrInvalidPassword
	}

	// salt for the password
	salt := user.PasswordSalt

	// derriving the kek
	kek := utils.DeriveKEK(input.Password, salt)

	// decrypting the master key
	masterKey, err := utils.DecryptMasterKey(kek, user.PasswordMasterKey, user.PasswordNonce)

	if err != nil {
		return false, errors.ErrInternalServer
	}

	// session of the app
	s.session = &Session{
		UserId:    user.ID,
		Username:  user.Username,
		MasterKey: masterKey,
	}

	return true, nil
}

func (s *Service) ResetPassword(input ResetPasswordInput) (*User, error) {
	if err := s.validate.Struct(input); err != nil {
		return nil, errors.ErrInvalidInput
	}

	user, err := s.repo.GetUserByUsername(context.Background(), input.Username)
	if err != nil {
		return nil, err
	}

	if user == nil {
		return nil, errors.ErrUserNotFound
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.RecoveryKey), []byte(input.RecoveryKey)); err != nil {
		return nil, errors.ErrInvalidRecoveryKey
	}

	// generate new recovery key
	newRecoveryKey, err := utils.GenerateRecoveryKey()
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// hash the new password to store
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// hash the new recovery key to store
	hashedRecoveryKey, err := bcrypt.GenerateFromPassword([]byte(newRecoveryKey), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// extract the original master key using the provided recovery key
	recoveryKek := utils.DeriveKEK(input.RecoveryKey, user.RecoverySalt)
	masterKey, err := utils.DecryptMasterKey(recoveryKek, user.RecoveryMasterKey, user.RecoveryNonce)
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// generate the new encrypted master key using password
	passwordKek := utils.DeriveKEK(input.NewPassword, user.PasswordSalt)
	passwordEncryptedMasterKey, passwordNonce, err := utils.EncryptMasterKey(passwordKek, masterKey)
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// generate the new encrypted master key using recovery key
	recoveryKek = utils.DeriveKEK(newRecoveryKey, user.RecoverySalt)
	recoveryEncryptedMasterKey, recoveryNonce, err := utils.EncryptMasterKey(recoveryKek, masterKey)
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// update the password and recovery key
	err = s.repo.UpdateUserPassword(context.Background(), user.ID, string(hashedPassword), string(hashedRecoveryKey), passwordEncryptedMasterKey, passwordNonce, recoveryEncryptedMasterKey, recoveryNonce)
	if err != nil {
		return nil, err
	}

	user.RecoveryKey = newRecoveryKey
	return user, nil
}

func (s *Service) Logout() {
	s.session = nil
}

func (s *Service) GetSession() *Session {
	return s.session
}

func (s *Service) RequireSession() (*Session, error) {
	if s.session == nil {
		return nil, errors.ErrUnauthorized
	}
	return s.session, nil
}
