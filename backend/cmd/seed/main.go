// Command seed fills a data dir with sample data for local development: seed [dir], default pb_data.
package main

import (
	"errors"
	"os"

	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/devseed"
	"github.com/ffneumarkt/intern/backend/internal/due"
	"github.com/ffneumarkt/intern/backend/internal/logging"
	"github.com/ffneumarkt/intern/backend/internal/material"
	_ "github.com/ffneumarkt/intern/backend/migrations"
)

func main() {
	logger := logging.New(os.Getenv("LOG_LEVEL"))

	dir := "pb_data"
	if len(os.Args) > 1 {
		dir = os.Args[1]
	}

	app := core.NewBaseApp(core.BaseAppConfig{DataDir: dir})
	if err := app.Bootstrap(); err != nil {
		logger.Fatal("open data dir", "err", err)
	}
	if err := app.RunAllMigrations(); err != nil {
		logger.Fatal("run migrations", "err", err)
	}
	material.Register(app)

	err := devseed.Seed(app, due.Today())
	if errors.Is(err, devseed.ErrAlreadySeeded) {
		logger.Info("nothing to do", "reason", err)
		return
	}
	if err != nil {
		logger.Fatal("seed", "err", err)
	}
	logger.Info("seeded", "dir", dir, "password", devseed.Password)
}
