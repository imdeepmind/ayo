package services

import (
	"errors"

	"ayo/backend/model"
	"ayo/backend/repository"
)

type Session struct {
	UserId   string
	Username string
}

type AuthService struct {
	session        *Session
	authRepository *repository.AuthRepository
}

func NewAuthService(authRepository *repository.AuthRepository) *AuthService {
	return &AuthService{
		authRepository: authRepository,
	}
}

func (a *AuthService) Register(username string, password string) (*model.User, error) {
	user, err := a.authRepository.CreateUser(username, password)
	if err != nil {
		return nil, err
	}

	return user, nil
}

// Login is a dummy login method
func (a *AuthService) Login(username string, password string) (bool, error) {
	if username == "" || password == "" {
		return false, errors.New("Username and password are required")
	}

	// Dummy logic
	if username == "admin" && password == "password" {
		a.session = &Session{
			UserId:   "1",
			Username: username,
		}
		return true, nil
	}

	return false, errors.New("Invalid username or password. Try admin / password.")
}
