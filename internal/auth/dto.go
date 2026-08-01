package auth

type RegisterInput struct {
	Username string `validate:"required,min=3,max=50,lowercase,alpha"`
	Password string `validate:"required,min=8,password_strength"`
}

type LoginInput struct {
	Username string `validate:"required,lowercase,alpha"`
	Password string `validate:"required"`
}

type ResetPasswordInput struct {
	Username    string `validate:"required,lowercase,alpha"`
	NewPassword string `validate:"required,min=8,password_strength"`
	RecoveryKey string `validate:"required"`
}

// RegisterResult carries the created user and the plaintext recovery key that
// must be shown to the user once. The recovery key is never stored in the User
// entity itself.
type RegisterResult struct {
	User        *User
	RecoveryKey string
}
