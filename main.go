package main

import (
	"ayo/backend/db"
	"ayo/backend/repository"
	"ayo/backend/services"

	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Internal Services
	db, err := db.NewDatabase("ayo.db")
	if err != nil {
		panic(err)
	}

	authRepository := repository.NewAuthRepository(db)
	authService := services.NewAuthService(authRepository)

	// Create application with options
	err = wails.Run(&options.App{
		Title:  "ayo",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		DisableResize:    false,
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
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
