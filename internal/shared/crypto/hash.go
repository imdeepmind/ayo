package crypto

import (
	"github.com/alexedwards/argon2id"
)

// HashPassword hashes a password (or recovery key) with Argon2id and returns
// the self-describing PHC string to persist, e.g.
// "$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>". The random salt is embedded
// in the string, so no separate salt column is needed.
func HashPassword(password string) (string, error) {
	return argon2id.CreateHash(password, argon2Params)
}

// VerifyPasswordHash checks a plaintext password against an Argon2id PHC hash
// produced by HashPassword. Parameters embedded in the hash are used, so it
// keeps working even if argon2Params later changes. A malformed or foreign
// hash returns false with an error.
func VerifyPasswordHash(password, encodedHash string) (bool, error) {
	return argon2id.ComparePasswordAndHash(password, encodedHash)
}
