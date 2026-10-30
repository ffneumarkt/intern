package passkey

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/charmbracelet/log"
	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

const displayName = "FF Intern"

// All login failures answer alike; the reason goes to the log.
const loginFailed = "Failed to authenticate."

type routes struct {
	web     *webauthn.WebAuthn
	pending *sessions
	logger  *log.Logger
}

// account adapts a user record to webauthn.User. The user handle is the record id.
type account struct {
	record      *core.Record
	credentials []webauthn.Credential
}

func (a *account) WebAuthnID() []byte                         { return []byte(a.record.Id) }
func (a *account) WebAuthnName() string                       { return a.record.Email() }
func (a *account) WebAuthnDisplayName() string                { return a.record.GetString("name") }
func (a *account) WebAuthnCredentials() []webauthn.Credential { return a.credentials }

// Register adds the passkey routes.
func Register(se *core.ServeEvent, cfg Config, logger *log.Logger) error {
	web, err := webauthn.New(&webauthn.Config{RPID: cfg.RPID, RPDisplayName: displayName, RPOrigins: cfg.Origins})
	if err != nil {
		return err
	}
	r := &routes{web: web, pending: newSessions(time.Now), logger: logger}

	group := se.Router.Group("/api/passkey")
	group.POST("/register/begin", r.registerBegin).Bind(apis.RequireAuth("users"))
	group.POST("/register/finish", r.registerFinish).Bind(apis.RequireAuth("users"))
	group.POST("/login/begin", r.loginBegin)
	group.POST("/login/finish", r.loginFinish)
	return nil
}

func loadAccount(app core.App, user *core.Record) (*account, error) {
	keys, err := app.FindAllRecords("passkeys", dbx.HashExp{"user": user.Id})
	if err != nil {
		return nil, err
	}
	credentials := make([]webauthn.Credential, 0, len(keys))
	for _, key := range keys {
		credential, err := toCredential(key)
		if err != nil {
			return nil, err
		}
		credentials = append(credentials, credential)
	}
	return &account{record: user, credentials: credentials}, nil
}

func toCredential(key *core.Record) (webauthn.Credential, error) {
	id, err := base64.RawURLEncoding.DecodeString(key.GetString("credential_id"))
	if err != nil {
		return webauthn.Credential{}, err
	}
	publicKey, err := base64.StdEncoding.DecodeString(key.GetString("public_key"))
	if err != nil {
		return webauthn.Credential{}, err
	}
	aaguid, err := hex.DecodeString(key.GetString("aaguid"))
	if err != nil {
		return webauthn.Credential{}, err
	}
	return webauthn.Credential{
		ID:        id,
		PublicKey: publicKey,
		// go-webauthn compares the backup flags on every login.
		Flags: webauthn.CredentialFlags{
			UserPresent:    true,
			BackupEligible: key.GetBool("backup_eligible"),
			BackupState:    key.GetBool("backup_state"),
		},
		Authenticator: webauthn.Authenticator{AAGUID: aaguid, SignCount: uint32(key.GetInt("sign_count"))},
	}, nil
}

func (r *routes) begin(e *core.RequestEvent, options any, session *webauthn.SessionData, userID string) error {
	id, err := r.pending.put(pending{Data: *session, UserID: userID})
	if err != nil {
		return err
	}
	return e.JSON(http.StatusOK, map[string]any{"sessionId": id, "options": options})
}

func (r *routes) registerBegin(e *core.RequestEvent) error {
	user, err := loadAccount(e.App, e.Auth)
	if err != nil {
		return err
	}
	exclusions := make([]protocol.CredentialDescriptor, 0, len(user.credentials))
	for _, credential := range user.credentials {
		exclusions = append(exclusions, credential.Descriptor())
	}
	creation, session, err := r.web.BeginRegistration(user,
		webauthn.WithResidentKeyRequirement(protocol.ResidentKeyRequirementRequired),
		webauthn.WithConveyancePreference(protocol.PreferNoAttestation),
		webauthn.WithExclusions(exclusions),
	)
	if err != nil {
		return err
	}
	return r.begin(e, creation.Response, session, e.Auth.Id)
}

func (r *routes) registerFinish(e *core.RequestEvent) error {
	var body struct {
		SessionID  string          `json:"sessionId"`
		Name       string          `json:"name"`
		Credential json.RawMessage `json:"credential"`
	}
	if err := e.BindBody(&body); err != nil {
		return e.BadRequestError("Invalid request.", err)
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		return e.BadRequestError("A name is required.", nil)
	}
	session, ok := r.pending.take(body.SessionID)
	if !ok || session.UserID != e.Auth.Id {
		return e.BadRequestError("Unknown session.", nil)
	}
	parsed, err := protocol.ParseCredentialCreationResponseBody(bytes.NewReader(body.Credential))
	if err != nil {
		return e.BadRequestError("Invalid credential.", err)
	}
	user, err := loadAccount(e.App, e.Auth)
	if err != nil {
		return err
	}
	credential, err := r.web.CreateCredential(user, session.Data, parsed)
	if err != nil {
		r.logger.Warn("passkey registration refused", "user", e.Auth.Id, "err", err)
		return e.BadRequestError("Invalid credential.", nil)
	}

	collection, err := e.App.FindCollectionByNameOrId("passkeys")
	if err != nil {
		return err
	}
	key := core.NewRecord(collection)
	key.Load(map[string]any{
		"user":            e.Auth.Id,
		"name":            name,
		"credential_id":   base64.RawURLEncoding.EncodeToString(credential.ID),
		"public_key":      base64.StdEncoding.EncodeToString(credential.PublicKey),
		"sign_count":      credential.Authenticator.SignCount,
		"aaguid":          hex.EncodeToString(credential.Authenticator.AAGUID),
		"backup_eligible": credential.Flags.BackupEligible,
		"backup_state":    credential.Flags.BackupState,
	})
	if err := e.App.Save(key); err != nil {
		r.logger.Warn("passkey not saved", "user", e.Auth.Id, "err", err)
		return e.BadRequestError("Invalid credential.", nil)
	}
	return e.JSON(http.StatusOK, key)
}

func (r *routes) loginBegin(e *core.RequestEvent) error {
	assertion, session, err := r.web.BeginDiscoverableLogin()
	if err != nil {
		return err
	}
	return r.begin(e, assertion.Response, session, "")
}

func (r *routes) loginFinish(e *core.RequestEvent) error {
	user, err := r.verifyLogin(e)
	if err != nil {
		r.logger.Warn("passkey login refused", "err", err)
		return e.BadRequestError(loginFailed, nil)
	}
	// Issues the token like a password login, including the check for deactivated users.
	return apis.RecordAuthResponse(e, user, "passkey", nil)
}

func (r *routes) verifyLogin(e *core.RequestEvent) (*core.Record, error) {
	var body struct {
		SessionID  string          `json:"sessionId"`
		Credential json.RawMessage `json:"credential"`
	}
	if err := e.BindBody(&body); err != nil {
		return nil, err
	}
	session, ok := r.pending.take(body.SessionID)
	if !ok {
		return nil, errors.New("unknown session")
	}
	parsed, err := protocol.ParseCredentialRequestResponseBody(bytes.NewReader(body.Credential))
	if err != nil {
		return nil, err
	}

	var user *core.Record
	findUser := func(_, userHandle []byte) (webauthn.User, error) {
		record, err := e.App.FindRecordById("users", string(userHandle))
		if err != nil {
			return nil, err
		}
		user = record
		return loadAccount(e.App, record)
	}
	credential, err := r.web.ValidateDiscoverableLogin(findUser, session.Data, parsed)
	if err != nil {
		return nil, err
	}
	// Checked here as well as by the auth hook, so the refusal is logged and writes nothing.
	if user.GetBool("deactivated") {
		return nil, fmt.Errorf("user %s is deactivated", user.Id)
	}
	// go-webauthn only reports a regression, it does not refuse.
	if credential.Authenticator.CloneWarning {
		return nil, fmt.Errorf("sign count regression for user %s", user.Id)
	}

	key, err := e.App.FindFirstRecordByData("passkeys", "credential_id", base64.RawURLEncoding.EncodeToString(credential.ID))
	if err != nil {
		return nil, err
	}
	key.Set("sign_count", credential.Authenticator.SignCount)
	key.Set("backup_state", credential.Flags.BackupState)
	if err := e.App.Save(key); err != nil {
		return nil, err
	}
	return user, nil
}
