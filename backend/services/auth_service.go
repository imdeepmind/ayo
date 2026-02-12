package services

import "errors"

type Session struct {
	UserId   string
	Username string
}

type AuthService struct {
	session *Session
}

func NewAuthService() *AuthService {
	return &AuthService{}
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
