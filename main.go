package main

import (
	"context"
	"fmt"

	dbclient "ayo/internal/clients/db"
	"ayo/internal/clients/storage"
	"ayo/internal/features/auth"
	"ayo/internal/features/dbconfig"
	"ayo/internal/features/recovery"
	"ayo/internal/features/settings"
	"ayo/internal/features/upload"
	"ayo/internal/platform/queue"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

// App is the root Wails-bound struct. It provides a minimal bridge between the
// webview frontend and the Go runtime (e.g. the application context).
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// storageValidator adapts the storage package's provider validation to the
// settings service's ProviderValidator interface, keeping settings decoupled
// from the storage implementation.
type storageValidator struct{}

func (storageValidator) Validate(key settings.CloudKey) error {
	return storage.Validate(key)
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// There is no global database: each account has its own database (SQLite
	// file or PostgreSQL server), stored encrypted in the OS keyring and opened
	// by the auth service on login. The shared connection holder lets the
	// queue/upload repositories serve whichever user is currently signed in.
	conn := dbclient.NewConnection()

	// Wire up the internal services. The auth service is the keystone: it owns
	// the in-memory session, the master key and the active database connection,
	// and is injected into the settings service (which needs the session to
	// gate access and the master key to encrypt/decrypt stored settings).
	// Database credentials are persisted in the OS keyring through the dbconfig
	// feature.
	dbconfigRepository := dbconfig.NewRepository()
	authService := auth.NewService(conn, dbconfigRepository)

	// Recovery service: native save dialogs for downloading the recovery key.
	recoveryService := recovery.NewService()

	// Settings service: stores per-user settings in the OS keyring, encrypted
	// with the session master key. Provider configs are validated through the
	// storage package before saving.
	settingsRepository := settings.NewRepository()
	settingsService := settings.NewService(authService, authService, storageValidator{}, settingsRepository)

	// Queue service: persistent SQLite-backed job queue shared across features.
	// It resolves the signed-in user's database connection per operation.
	queueService := queue.NewService(conn)

	// Storage client: the local filesystem backend the upload feature reads and
	// writes its own runtime files (encrypted staging, downloads) and local
	// shards through. S3 clients for cloud shards are created on demand from the
	// user's configured AWS keys; both implement the same storage.Client
	// interface. Remote backends (Azure Blob, GCP) can be added the same way.
	fileClient := storage.NewLocalFilesystem()

	// Upload service: native file selection + enqueues one job per uploaded
	// file into the queue. The processor encrypts each file, splits it into
	// Reed-Solomon shards using the erasure-coding settings, and persists the
	// stored-file record and its shards to the uploads/chunks tables of the
	// signed-in user's database.
	uploadService := upload.NewService(authService, settingsService, queueService, conn, fileClient)

	// Create application with options. Anything passed to Bind is exposed to
	// the frontend as generated JavaScript bindings under
	// frontend/wailsjs/go/, so changing a bound method requires a
	// wails dev / wails build to regenerate them.
	err := wails.Run(&options.App{
		Title:  "ayo",
		Width:  1100,
		Height: 768,
		AssetServer: &assetserver.Options{
			// The compiled frontend (frontend/dist) is embedded into the binary
			// via assets.go.
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			// Only services that need the Wails context receive it here.
			recoveryService.Startup(ctx)
			uploadService.Startup(ctx)
			settingsService.Startup(ctx)
		},
		DisableResize: false,
		Mac: &mac.Options{
			TitleBar: &mac.TitleBar{
				TitlebarAppearsTransparent: false,
				HideTitle:                  false,
				HideTitleBar:               false,
				FullSizeContent:            false,
				UseToolbar:                 false,
				HideToolbarSeparator:       true,
			},
			Appearance:           mac.NSAppearanceNameDarkAqua,
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			About: &mac.AboutInfo{
				Title:   "ayo",
				Message: "A Wails Application",
				Icon:    nil,
			},
		},
		// Every service listed here is callable from the React frontend.
		Bind: []interface{}{
			app,
			authService,
			recoveryService,
			settingsService,
			uploadService,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
