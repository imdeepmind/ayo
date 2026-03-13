package auth

type User struct {
	ID                int64
	Username          string
	PasswordHash      string
	RecoveryKey       string
	PasswordSalt      []byte
	PasswordNonce     []byte
	PasswordMasterKey []byte
	RecoverySalt      []byte
	RecoveryNonce     []byte
	RecoveryMasterKey []byte
}
