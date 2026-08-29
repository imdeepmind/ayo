package recovery

import (
	"context"
	"os"

	"ayo/internal/shared/dialog"
)

// Service handles saving the user's recovery key to a file. It is the
// frontend-facing counterpart of the recovery-key flow in auth: after
// registration or a password reset the user downloads the key via
// SaveRecoveryKey so it can be stored somewhere safe.
type Service struct {
	ctx context.Context
}

func NewService() *Service {
	return &Service{}
}

// Startup is called by Wails on application startup
func (s *Service) Startup(ctx context.Context) {
	s.ctx = ctx
}

// SaveRecoveryKey opens a save file dialog and saves the recovery key to the selected location
func (s *Service) SaveRecoveryKey(username, recoveryKey string) error {
	filePath, err := dialog.SaveFile(s.ctx, dialog.Options{
		DefaultFilename:   "recovery-key-" + username + ".txt",
		Title:             "Save Recovery Key",
		FileFilterName:    "Text Files (*.txt)",
		FileFilterPattern: "*.txt",
	})
	if err != nil {
		return err
	}

	// User cancelled the dialog
	if filePath == "" {
		return nil
	}

	// Write the recovery key to the file
	return os.WriteFile(filePath, []byte(recoveryKey), 0600)
}
