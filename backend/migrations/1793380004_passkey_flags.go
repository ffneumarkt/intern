package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(addPasskeyFlags, removePasskeyFlags)
}

// passkeyUpdateRule lets the owner change the name and nothing else.
func passkeyUpdateRule(fields ...string) *string {
	return rule(own, unchanged(append([]string{"user", "credential_id", "public_key", "sign_count", "aaguid"}, fields...)...))
}

// addPasskeyFlags stores the backup flags, which go-webauthn compares on every login: without them
// a synced passkey fails on its second use.
func addPasskeyFlags(app core.App) error {
	passkeys, err := app.FindCollectionByNameOrId("passkeys")
	if err != nil {
		return err
	}
	passkeys.Fields.Add(
		&core.BoolField{Name: "backup_eligible"},
		&core.BoolField{Name: "backup_state"},
		created(),
	)
	passkeys.UpdateRule = passkeyUpdateRule("backup_eligible", "backup_state")
	return app.Save(passkeys)
}

func removePasskeyFlags(app core.App) error {
	passkeys, err := app.FindCollectionByNameOrId("passkeys")
	if err != nil {
		return err
	}
	passkeys.Fields.RemoveByName("backup_eligible")
	passkeys.Fields.RemoveByName("backup_state")
	passkeys.Fields.RemoveByName("created")
	passkeys.UpdateRule = passkeyUpdateRule()
	return app.Save(passkeys)
}
