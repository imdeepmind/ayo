package home

// RecentFile is the frontend-facing representation of one of the most recently
// uploaded files shown on the Home screen. Format is the lowercased file
// extension without the leading dot (e.g. "pdf"); UpdatedAt is an RFC3339
// string so the Wails model stays a flat, predictable shape.
type RecentFile struct {
	ID        int64
	Name      string
	Format    string
	Size      int64
	UpdatedAt string
}

// HomeOverview aggregates the storage summary and recent activity shown on the
// Home screen. TotalSizeUsed is the logical sum of the uploads.size column;
// ActualSizeUsed is the real bytes physically stored across providers (shard
// size x data+parity shards x block count per file). ErasureCodingSetup is the
// current data+parity layout (e.g. "6+3"), or "0+0" when erasure coding is
// disabled.
type HomeOverview struct {
	RecentFiles        []RecentFile
	TotalFiles         int
	TotalSizeUsed      int64
	ActualSizeUsed     int64
	TotalProviders     int
	ErasureCodingSetup string
}

// StoredFile is the frontend-facing representation of one row of the `uploads`
// table, used by the Home/drive screen. Timestamps are strings so the Wails
// model stays a flat, predictable shape.
type StoredFile struct {
	ID        int64
	Name      string
	Size      int64
	Tags      []string
	CreatedAt string
}

// StoredFilePage is one page of the drive listing returned by GetStoredFiles.
// Total is the count of all matching rows (unbounded by page size) so the
// frontend can render pagination controls.
type StoredFilePage struct {
	Files    []StoredFile
	Total    int64
	Page     int
	PageSize int
}

// ProviderDetails describes one storage provider that holds shards of a stored
// file. Type lets the frontend render the provider logo; ID uniquely
// identifies the provider instance (e.g. "aws_ab12cd34"); Name is the
// human-friendly label and Resource the bucket/container/folder it maps to, so
// two providers of the same type stay distinguishable.
type ProviderDetails struct {
	ID       string
	Type     string
	Name     string
	Resource string
}

// FileDetails is the frontend-facing detail view of one stored file, returned
// by GetFileDetails. It surfaces the original name, the original and
// erasure-coded stored sizes (the latter grows due to redundancy), the
// encryption layout and the distinct providers the file's shards were
// distributed across. Timestamps are RFC3339 strings so the Wails model stays
// a flat, predictable shape.
type FileDetails struct {
	ID           int64
	OriginalName string
	CustomName   string
	Size         int64
	StoredSize   int64
	Tags         []string
	DataShards   int
	ParityShards int
	Providers    []ProviderDetails
	CreatedAt    string
	UpdatedAt    string
}
