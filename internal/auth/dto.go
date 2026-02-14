package auth

type RegisterInput struct {
	Username string `validate:"required,min=3,max=50"`
	Password string `validate:"required,min=6"`
}

type LoginInput struct {
	Username string `validate:"required"`
	Password string `validate:"required"`
}

type ResetPasswordInput struct {
	Username    string `validate:"required"`
	NewPassword string `validate:"required"`
	RecoveryKey string `validate:"required"`
}
