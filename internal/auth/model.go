package auth

type User struct {
	ID           int64
	Username     string
	PasswordHash string
	RecoveryKey  string
	Salt         []byte
	Nonce        []byte
	MasterKey    []byte
}
