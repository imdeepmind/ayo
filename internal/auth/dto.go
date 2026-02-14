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
