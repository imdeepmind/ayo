package upload

// PickedFile is a file selected through the native file dialog. It carries the
// on-disk path the backend needs to process the file later, which the webview
// cannot provide for HTML file inputs on macOS.
type PickedFile struct {
	Name string
	Path string
	Size int64
}

// EnqueuedJob is the frontend-facing representation of a queued file. It is a
// slimmed-down view of a queue.Job: timestamps are omitted so the Wails model
// stays a flat, predictable shape.
type EnqueuedJob struct {
	ID         int64
	File       string
	CustomName string
	Size       int64
	Status     string
	Progress   int
	Tags       []string
}
