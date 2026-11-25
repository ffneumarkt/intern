package main

import (
	"errors"
	"fmt"

	"github.com/pocketbase/pocketbase/core"
	"github.com/spf13/cobra"

	"github.com/ffneumarkt/intern/backend/internal/defaults"
)

// bootstrapCommand sets up a new environment in one step: the station's categories, check types and
// locations (internal/defaults/defaults.json), and with --admin-email the first admin. It can run again
// without harm; what exists is left as it is.
func bootstrapCommand(app core.App) *cobra.Command {
	var email, name, password string
	cmd := &cobra.Command{
		Use:   "bootstrap",
		Short: "Add the default categories, check types and locations, and optionally the first admin",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if email == "" && (name != "" || password != "") {
				return errors.New("--admin-name and --admin-password need --admin-email")
			}
			out := cmd.OutOrStdout()
			// On an empty data directory nothing has created the collections yet: only `serve` runs the migrations.
			if err := app.RunAllMigrations(); err != nil {
				return fmt.Errorf("migrations: %w", err)
			}
			summary, err := defaults.Apply(app)
			if err != nil {
				return err
			}
			fmt.Fprintf(out, "added %d categories, %d check types, %d locations\n", summary.Categories, summary.CheckTypes, summary.Locations)
			if email == "" {
				return nil
			}
			if name == "" {
				name = email
			}
			created, err := defaults.CreateAdmin(app, email, name, password)
			if err != nil {
				return err
			}
			fmt.Fprintf(out, "admin: %s (all admin areas, manage on every category)\n", email)
			if created != "" && password == "" {
				fmt.Fprintf(out, "password: %s\n", created)
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&email, "admin-email", "", "email of the first admin (created if missing)")
	cmd.Flags().StringVar(&name, "admin-name", "", "name of the first admin")
	cmd.Flags().StringVar(&password, "admin-password", "", "password of a new admin (default: generated and printed once)")
	return cmd
}
