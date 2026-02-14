package main

import (
	"ayo/internal/auth"
	"ayo/internal/fileops"
	"ayo/internal/platform/database"
	"context"
	"fmt"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

// App struct
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

	// Internal Services
	// Use local data directory for development simplicity
	db, err := database.NewDatabase("data/ayo.db")
	if err != nil {
		panic(err)
	}

	// Initialize Auth Module
	authRepository := auth.NewRepository(db)
	authService := auth.NewService(authRepository)

	// Initialize File Operations Service
	fileOpsService := fileops.NewService()

	// Create application with options
	err = wails.Run(&options.App{
		Title:  "ayo",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			fileOpsService.Startup(ctx)
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
		Bind: []interface{}{
			app,
			authService,
			fileOpsService,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
