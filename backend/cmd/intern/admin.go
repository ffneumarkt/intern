package main

import (
	"fmt"
	"strings"

	"github.com/pocketbase/pocketbase/core"
	"github.com/spf13/cobra"

	"github.com/ffneumarkt/intern/backend/internal/admin"
)

// adminCommand manages the admin rights from the command line. It is how the first admin is made,
// since the app's own screens need one.
func adminCommand(app core.App) *cobra.Command {
	root := &cobra.Command{Use: "admin", Short: "Grant, revoke and list admin rights"}
	areas := strings.Join(admin.Areas, ", ")

	root.AddCommand(&cobra.Command{
		Use:   "grant EMAIL AREA...",
		Short: "Give a user admin areas (" + areas + ")",
		Args:  cobra.MinimumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := admin.Grant(app, args[0], args[1:]...); err != nil {
				return err
			}
			fmt.Fprintf(cmd.OutOrStdout(), "%s: granted %s\n", args[0], strings.Join(args[1:], ", "))
			return nil
		},
	})
	root.AddCommand(&cobra.Command{
		Use:   "revoke EMAIL AREA...",
		Short: "Take admin areas from a user",
		Args:  cobra.MinimumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := admin.Revoke(app, args[0], args[1:]...); err != nil {
				return err
			}
			fmt.Fprintf(cmd.OutOrStdout(), "%s: revoked %s\n", args[0], strings.Join(args[1:], ", "))
			return nil
		},
	})
	root.AddCommand(&cobra.Command{
		Use:   "list",
		Short: "List who holds which admin areas",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			holders, err := admin.List(app)
			if err != nil {
				return err
			}
			for _, h := range holders {
				fmt.Fprintf(cmd.OutOrStdout(), "%s: %s\n", h.Email, strings.Join(h.Areas, ", "))
			}
			return nil
		},
	})
	return root
}
