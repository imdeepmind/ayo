package dbconfig

import (
	dbclient "ayo/internal/clients/db"
)

// DBCredentials is the plaintext database configuration for one account. It is
// serialized to JSON, dual-encrypted (password-KEK + recovery-KEK) and stored
// in the OS keyring; only the encrypted blob ever persists. The password is
// stored here too (it is needed to open the connection at login) but is never
// exposed to the frontend.
type DBCredentials struct {
	Type     dbclient.Dialect `json:"Type"`
	Path     string           `json:"Path,omitempty"`
	Host     string           `json:"Host,omitempty"`
	Port     int              `json:"Port,omitempty"`
	Database string           `json:"Database,omitempty"`
	Username string           `json:"Username,omitempty"`
	Password string           `json:"Password,omitempty"`
}

// ToConfig converts the stored credentials into a client config usable with
// dbclient.NewClient / dbclient.Validate.
func (d DBCredentials) ToConfig() dbclient.Config {
	return dbclient.Config{
		Type:     d.Type,
		Path:     d.Path,
		Host:     d.Host,
		Port:     d.Port,
		Database: d.Database,
		Username: d.Username,
		Password: d.Password,
	}
}

// FromConfig builds stored credentials from a client config.
func FromConfig(c dbclient.Config) DBCredentials {
	return DBCredentials{
		Type:     c.Type,
		Path:     c.Path,
		Host:     c.Host,
		Port:     c.Port,
		Database: c.Database,
		Username: c.Username,
		Password: c.Password,
	}
}
