package auth

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
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

func generateMasterKey() ([]byte, error) {
	masterKey := make([]byte, keySize)

	_, err := io.ReadFull(rand.Reader, masterKey)
	if err != nil {
		return nil, err
	}

	return masterKey, nil
}

func encryptMasterKey(kek []byte, masterKey []byte) ([]byte, []byte, error) {
	block, err := aes.NewCipher(kek)
	if err != nil {
		return nil, nil, err
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, err
	}

	return aead.Seal(nil, nonce, masterKey, nil), nonce, nil
}

func decryptMasterKey(kek []byte, encryptedMasterKey []byte, nonce []byte) ([]byte, error) {
	block, err := aes.NewCipher(kek)
	if err != nil {
		return nil, err
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	mk, err := aead.Open(nil, nonce, encryptedMasterKey, nil)
	if err != nil {
		return nil, err
	}

	return mk, nil
}

func deriveKEK(password string, salt []byte) []byte {

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

	// Generate passwordSalt
	passwordSalt, err := generateSalt()
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// Generate recoverySalt
	recoverySalt, err := generateSalt()
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// generating a master key
	masterKey, err := generateMasterKey()
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// encrypt master key with password
	passwordKek := deriveKEK(input.Password, passwordSalt)
	passwordEncryptedMasterKey, passwordNonce, err := encryptMasterKey(passwordKek, masterKey)
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// encrypt master key with recovery key
	recoveryKek := deriveKEK(recoveryKey, recoverySalt)
	recoveryEncryptedMasterKey, recoveryNonce, err := encryptMasterKey(recoveryKek, masterKey)

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
	kek := deriveKEK(input.Password, salt)

	// decrypting the master key
	masterKey, err := decryptMasterKey(kek, user.PasswordMasterKey, user.PasswordNonce)

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
	newRecoveryKey, err := generateRecoveryKey()
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
	recoveryKek := deriveKEK(input.RecoveryKey, user.RecoverySalt)
	masterKey, err := decryptMasterKey(recoveryKek, user.RecoveryMasterKey, user.RecoveryNonce)
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// generate the new encrypted master key using password
	passwordKek := deriveKEK(input.NewPassword, user.PasswordSalt)
	passwordEncryptedMasterKey, passwordNonce, err := encryptMasterKey(passwordKek, masterKey)
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// generate the new encrypted master key using recovery key
	recoveryKek = deriveKEK(newRecoveryKey, user.RecoverySalt)
	recoveryEncryptedMasterKey, recoveryNonce, err := encryptMasterKey(recoveryKek, masterKey)
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
