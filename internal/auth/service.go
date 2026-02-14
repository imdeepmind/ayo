package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	stdErrors "errors"
	"fmt"

	"ayo/internal/errors"

	"github.com/go-playground/validator/v10"
	"golang.org/x/crypto/bcrypt"
)

type Session struct {
	UserId   string
	Username string
}

type Service struct {
	session  *Session
	repo     Repository
	validate *validator.Validate
}

func NewService(repo Repository) *Service {
	return &Service{
		repo:     repo,
		validate: validator.New(),
	}
}

func GenerateRecoveryKey() (string, error) {
	const size = 32 // 256 bits

	b := make([]byte, size)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (s *Service) Register(input RegisterInput) (*User, error) {
	// 1. Input Validation
	if err := s.validate.Struct(input); err != nil {
		return nil, errors.ErrInvalidInput
	}

	// 2. Generate Recovery Key
	recoveryKey, err := GenerateRecoveryKey()
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// 3. Hash Password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.ErrInternalServer
	}

	// 4. Create User in Repository
	user, err := s.repo.CreateUser(context.Background(), input.Username, string(hashedPassword), recoveryKey)
	if err != nil {
		return nil, err
	}

	return user, nil
}

// Login is a dummy login method
func (s *Service) Login(input LoginInput) (bool, error) {
	if err := s.validate.Struct(input); err != nil {
		return false, errors.ErrInvalidInput
	}

	// Dummy logic - unchanged as requested
	if input.Username == "admin" && input.Password == "password" {
		s.session = &Session{
			UserId:   "1",
			Username: input.Username,
		}
		return true, nil
	}

	return false, stdErrors.New("invalid username or password")
}
