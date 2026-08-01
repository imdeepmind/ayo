package dialog

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Options configures a native save-file dialog.
type Options struct {
	DefaultFilename   string
	Title             string
	FileFilterName    string
	FileFilterPattern string
}

// SaveFile opens the native save-file dialog and returns the selected path, or
// an empty string when the user cancels.
func SaveFile(ctx context.Context, opts Options) (string, error) {
	var filters []runtime.FileFilter
	if opts.FileFilterName != "" {
		filters = append(filters, runtime.FileFilter{
			DisplayName: opts.FileFilterName,
			Pattern:     opts.FileFilterPattern,
		})
	}

	return runtime.SaveFileDialog(ctx, runtime.SaveDialogOptions{
		DefaultFilename: opts.DefaultFilename,
		Title:           opts.Title,
		Filters:         filters,
	})
}
