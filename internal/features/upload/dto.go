package upload

// EnqueueFilesInput is the Wails-bound payload for queuing files. Each entry
// becomes one job in the queue.
type EnqueueFilesInput struct {
	Files []EnqueueFileInput `validate:"required,min=1,dive"`
}

// EnqueueFileInput describes a single file to enqueue. Name and Path must be
// present; CustomName and Tags are optional and default to the original name
// and no tags when omitted.
type EnqueueFileInput struct {
	Name       string `validate:"required"`
	CustomName string
	Path       string `validate:"required"`
	Size       int64  `validate:"min=0"`
	Tags       []string
}
