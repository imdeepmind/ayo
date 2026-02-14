package fileops

import (
	"context"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

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
	defaultFilename := "recovery-key-" + username + ".txt"

	// Open save file dialog
	filePath, err := runtime.SaveFileDialog(s.ctx, runtime.SaveDialogOptions{
		DefaultFilename: defaultFilename,
		Title:           "Save Recovery Key",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Text Files (*.txt)",
				Pattern:     "*.txt",
			},
		},
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
