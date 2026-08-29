// Package dialog wraps Wails' native desktop dialogs behind a small,
// platform-independent API.
//
// It lives in the shared tier: it hides the Wails runtime dependency so feature
// packages (e.g. auth, upload) can prompt the user for file paths without
// importing the runtime themselves. Add open-dir / open-file wrappers here as
// features need them.
package dialog

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Options configures a native save-file dialog.
type Options struct {
	// DefaultFilename is the pre-filled name in the dialog (e.g. "report.txt").
	DefaultFilename string
	// Title is the dialog window title.
	Title string
	// FileFilterName and FileFilterPattern define a single file-type filter.
	// When both are empty, no filter is applied and all files are shown.
	FileFilterName    string
	FileFilterPattern string // glob pattern, e.g. "*.txt"
}

// OpenFolder opens the native directory-selection dialog and returns the
// selected directory path. An empty string is returned (with a nil error) when
// the user cancels the dialog, so callers should check for "" before using the
// result. The dialog requires the Wails application context, which is typically
// the one stored by the feature service at Startup.
func OpenFolder(ctx context.Context, opts Options) (string, error) {
	return runtime.OpenDirectoryDialog(ctx, runtime.OpenDialogOptions{
		Title: opts.Title,
	})
}

// SaveFile opens the native save-file dialog and returns the selected path.
//
// An empty string is returned (with a nil error) when the user cancels the
// dialog, so callers should check for "" before using the result. The dialog
// requires the Wails application context, which is typically the one stored by
// the feature service at Startup.
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
