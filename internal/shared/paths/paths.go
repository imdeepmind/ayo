// Package paths provides OS-specific filesystem paths used by the app, such as
// the per-user app data directory where SQLite databases are stored.
package paths

import (
	"os"
	"path/filepath"
)

// GetAppDataDir returns the OS-appropriate app data directory for ayo:
//
//	macOS:   ~/Library/Application Support/ayo
//	Linux:   ~/.config/ayo
//	Windows: %APPDATA%\ayo
//
// It is derived from os.UserConfigDir plus the "/ayo" app segment. The
// directory is not created here; callers create it when needed.
func GetAppDataDir() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "ayo"), nil
}
