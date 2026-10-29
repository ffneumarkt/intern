package main

import (
	"log"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"github.com/ffneumarkt/intern/backend/internal/server"
	_ "github.com/ffneumarkt/intern/backend/migrations"
	"github.com/ffneumarkt/intern/backend/ui"
)

func main() {
	app := pocketbase.New()

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangGo,
		Automigrate:  false,
	})

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		server.RegisterFrontend(se, ui.Dist())
		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
