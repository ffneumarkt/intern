package main

import (
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"github.com/ffneumarkt/intern/backend/internal/due"
	"github.com/ffneumarkt/intern/backend/internal/logging"
	"github.com/ffneumarkt/intern/backend/internal/material"
	"github.com/ffneumarkt/intern/backend/internal/server"
	_ "github.com/ffneumarkt/intern/backend/migrations"
	"github.com/ffneumarkt/intern/backend/ui"
)

func main() {
	logger := logging.New(os.Getenv("LOG_LEVEL"))

	app := pocketbase.New()

	material.Register(app)

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangGo,
		Automigrate:  false,
	})

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		material.RegisterRoutes(se, due.Today)
		server.RegisterFrontend(se, ui.Dist())
		return se.Next()
	})

	if err := app.Start(); err != nil {
		logger.Fatal("app stopped", "err", err)
	}
}
