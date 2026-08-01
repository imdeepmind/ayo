package main

import (
	"context"
	"fmt"

	"ayo/internal/auth"
	"ayo/internal/fileops"
	"ayo/internal/platform/database"
	"ayo/internal/settings"

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

	// Open the SQLite database (data/ayo.db). For development simplicity the
	// path is relative to the current working directory; data/ is gitignored.
	db, err := database.NewDatabase("data/ayo.db")
	if err != nil {
		panic(err)
	}

	// Wire up the internal services. The auth service is the keystone: it owns
	// the in-memory session and master key, and is injected into the settings
	// service (which needs the session to gate access and the master key to
	// encrypt/decrypt stored settings).
	authRepository, err := auth.NewRepository(db)
	if err != nil {
		panic(err)
	}
	authService := auth.NewService(authRepository)

	// File operations service: native save dialogs (used for recovery keys).
	fileOpsService := fileops.NewService()

	// Settings service: stores per-user settings in the OS keyring, encrypted
	// with the session master key.
	settingsService := settings.NewService(authService)

	// Create application with options. Anything passed to Bind is exposed to
	// the frontend as generated JavaScript bindings under
	// frontend/wailsjs/go/, so changing a bound method requires a
	// wails dev / wails build to regenerate them.
	err = wails.Run(&options.App{
		Title:  "ayo",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			// The compiled frontend (frontend/dist) is embedded into the binary
			// via assets.go.
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			// Services that need the Wails context receive it here.
			fileOpsService.Startup(ctx)
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
			fileOpsService,
			settingsService,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
