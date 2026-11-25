package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"github.com/spf13/cobra"

	"github.com/ffneumarkt/intern/backend/internal/admin"
	"github.com/ffneumarkt/intern/backend/internal/due"
	"github.com/ffneumarkt/intern/backend/internal/logging"
	"github.com/ffneumarkt/intern/backend/internal/material"
	"github.com/ffneumarkt/intern/backend/internal/notify"
	"github.com/ffneumarkt/intern/backend/internal/passkey"
	"github.com/ffneumarkt/intern/backend/internal/push"
	"github.com/ffneumarkt/intern/backend/internal/server"
	"github.com/ffneumarkt/intern/backend/internal/snapshot"
	_ "github.com/ffneumarkt/intern/backend/migrations"
	"github.com/ffneumarkt/intern/backend/ui"
)

func main() {
	logger := logging.New(os.Getenv("LOG_LEVEL"))

	app := pocketbase.New()

	material.Register(app)
	admin.Register(app)

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangGo,
		Automigrate:  false,
	})

	app.RootCmd.AddCommand(vapidCommand())
	app.RootCmd.AddCommand(snapshotCommand(app))
	app.RootCmd.AddCommand(adminCommand(app))

	keys, pushEnabled := push.KeysFromEnv()

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		server.ShieldAdminAPI(se)
		admin.RegisterRoutes(se, logger)
		material.RegisterRoutes(se, due.Today)
		if err := passkey.Register(se, passkey.ConfigFromEnv(), logger); err != nil {
			return err
		}
		if pushEnabled {
			sender := &push.Sender{App: app, Keys: keys, Logger: logger}
			push.RegisterRoutes(se, keys, sender, logger)
			notify.Schedule(&notify.Job{App: app, Sender: sender, Logger: logger})
		} else {
			push.RegisterRoutes(se, keys, nil, logger)
			logger.Warn("push is not set up, VAPID keys are missing")
		}
		server.RegisterFrontend(se, ui.Dist())
		return se.Next()
	})

	if err := app.Start(); err != nil {
		logger.Fatal("app stopped", "err", err)
	}
}

// vapidCommand prints a new VAPID key pair for the environment. It needs no keys itself.
func vapidCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "vapid",
		Short: "Generate a VAPID key pair for web push",
		RunE: func(cmd *cobra.Command, _ []string) error {
			private, public, err := webpush.GenerateVAPIDKeys()
			if err != nil {
				return err
			}
			fmt.Println("VAPID_PUBLIC_KEY=" + public)
			fmt.Println("VAPID_PRIVATE_KEY=" + private)
			return nil
		},
	}
}

// snapshotCommand writes a gzipped, consistent copy of data.db to stdout for the backup (spec §10).
// Diagnostics go to stderr, so stdout carries only the archive.
func snapshotCommand(app core.App) *cobra.Command {
	return &cobra.Command{
		Use:   "snapshot",
		Short: "Write a gzipped consistent copy of data.db to stdout",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return snapshot.Write(filepath.Join(app.DataDir(), "data.db"), cmd.OutOrStdout())
		},
	}
}
