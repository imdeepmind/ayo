package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"regexp"

	"ayo/internal/errors"

	"io"

	"github.com/go-playground/validator/v10"
	"golang.org/x/crypto/argon2"
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

const (
	saltSize = 16
	keySize  = 32
	timeCost = 3
	memory   = 64 * 1024
	threads  = 4
)

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

func generateRecoveryKey() (string, error) {
	const size = 32 // 256 bits

	b := make([]byte, size)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(b), nil
}

func generateSalt() ([]byte, error) {
	salt := make([]byte, saltSize)

	_, err := io.ReadFull(rand.Reader, salt)
	if err != nil {
		return nil, err
	}

	return salt, nil
}

func generateEncryptedMasterKey(kek []byte) []byte {
	// TODO: Impliment the master key generation
	return kek
}

func decryptMasterKey(kek []byte, encryptedMasterKey []byte) []byte {
	// TODO: Impliment the master key decryption
	return encryptedMasterKey
}

func DeriveKEK(password string, salt []byte) []byte {

	kek := argon2.IDKey(
		[]byte(password),
		salt,
		timeCost,
		memory,
		threads,
		keySize,
	)

	return kek
}

func (s *Service) Register(input RegisterInput) (*User, error) {
	if err := s.validate.Struct(input); err != nil {
		return nil, errors.ErrInvalidInput
	}

	recoveryKey, err := generateRecoveryKey()
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

	// Generate salt
	salt, err := generateSalt()
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	kek := DeriveKEK(input.Password, salt)
	encryptedMasterKey := generateEncryptedMasterKey(kek)

	user, err := s.repo.CreateUser(context.Background(), input.Username, string(hashedPassword), string(hashedRecoveryKey), salt, encryptedMasterKey)
	if err != nil {
		return nil, err
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
		return false, err
	}

	if user == nil {
		return false, errors.ErrUserNotFound
	}

	salt := user.Salt

	kek := DeriveKEK(input.Password, salt)

	masterKey := decryptMasterKey(kek, user.MasterKey)

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return false, errors.ErrInvalidPassword
	}

	s.session = &Session{
		UserId:    user.ID,
		Username:  user.Username,
		MasterKey: masterKey,
	}

	return true, nil
}

func (s *Service) Logout() {
	s.session = nil
}

func (s *Service) GetSession() *Session {
	return s.session
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

	newRecoveryKey, err := generateRecoveryKey()
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	hashedRecoveryKey, err := bcrypt.GenerateFromPassword([]byte(newRecoveryKey), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	err = s.repo.UpdateUserPassword(context.Background(), user.ID, string(hashedPassword))
	if err != nil {
		return nil, err
	}

	err = s.repo.UpdateUserRecoveryKey(context.Background(), user.ID, string(hashedRecoveryKey))
	if err != nil {
		return nil, err
	}

	user.RecoveryKey = newRecoveryKey
	return user, nil
}
