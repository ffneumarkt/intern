package admin

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/charmbracelet/log"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// linkLifetime is how long a setup link works.
const linkLifetime = 24 * time.Hour

type api struct {
	logger *log.Logger
	now    func() time.Time
}

// RegisterRoutes adds the member routes (behind the members right) and the public setup routes.
func RegisterRoutes(se *core.ServeEvent, logger *log.Logger) {
	a := &api{logger: logger, now: time.Now}

	members := se.Router.Group("/api/admin/members")
	members.Bind(apis.RequireAuth("users"))
	members.GET("", a.list)
	members.POST("", a.create)
	members.PATCH("/{id}", a.patch)
	members.POST("/{id}/setup-link", a.setupLink)

	setup := se.Router.Group("/api/setup")
	setup.BindFunc(noReferrer)
	setup.POST("/check", a.checkLink)
	setup.POST("/complete", a.completeLink)
}

// Holds reports whether the user holds the admin area.
func Holds(app core.App, userID, area string) bool {
	n, err := app.CountRecords("admin_rights", dbx.HashExp{"user": userID, "area": area})
	return err == nil && n > 0
}

func (a *api) requireMembers(e *core.RequestEvent) error {
	if !Holds(e.App, e.Auth.Id, Members) {
		return e.ForbiddenError("", nil)
	}
	return nil
}

// decode reads a JSON body that has the fields of v and no others.
func decode(e *core.RequestEvent, v any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(e.Response, e.Request.Body, 1<<14))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(v); err != nil {
		return e.BadRequestError("Invalid request.", err)
	}
	return nil
}

type memberJSON struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Email       string   `json:"email"`
	Deactivated bool     `json:"deactivated"`
	Areas       []string `json:"areas"`
}

func (a *api) list(e *core.RequestEvent) error {
	if err := a.requireMembers(e); err != nil {
		return err
	}
	users, err := e.App.FindAllRecords("users")
	if err != nil {
		return err
	}
	rights, err := e.App.FindAllRecords("admin_rights")
	if err != nil {
		return err
	}
	areas := map[string][]string{}
	for _, area := range Areas {
		for _, right := range rights {
			if right.GetString("area") == area {
				areas[right.GetString("user")] = append(areas[right.GetString("user")], area)
			}
		}
	}
	out := make([]memberJSON, 0, len(users))
	for _, u := range users {
		out = append(out, memberJSON{ID: u.Id, Name: u.GetString("name"), Email: u.Email(), Deactivated: u.GetBool("deactivated"), Areas: append([]string{}, areas[u.Id]...)})
	}
	return e.JSON(http.StatusOK, out)
}

type issuedJSON struct {
	ID      string `json:"id,omitempty"`
	Token   string `json:"token"`
	Expires string `json:"expires"`
}

func (a *api) create(e *core.RequestEvent) error {
	if err := a.requireMembers(e); err != nil {
		return err
	}
	var body struct{ Name, Email string }
	if err := decode(e, &body); err != nil {
		return err
	}
	name, email := strings.TrimSpace(body.Name), strings.TrimSpace(body.Email)
	if parsed, err := mail.ParseAddress(email); name == "" || err != nil || parsed.Address != email {
		return e.BadRequestError("Name and a valid email are required.", nil)
	}

	var out issuedJSON
	err := e.App.RunInTransaction(func(tx core.App) error {
		users, err := tx.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}
		user := core.NewRecord(users)
		user.SetEmail(email)
		user.Set("name", name)
		// Nobody knows this password; the member picks theirs through the setup link.
		user.SetPassword(randomToken())
		if err := tx.Save(user); err != nil {
			return err
		}
		token, expires, err := issueLink(tx, user.Id, a.now())
		if err != nil {
			return err
		}
		out = issuedJSON{ID: user.Id, Token: token, Expires: expires.UTC().Format(time.RFC3339)}
		return Log(tx, e.Auth.Id, "create", "users", user.Id, map[string]any{"name": name, "email": email})
	})
	if err != nil {
		return e.BadRequestError("The member could not be created.", err)
	}
	a.logger.Info("member created", "admin", e.Auth.Id, "member", out.ID)
	return e.JSON(http.StatusOK, out)
}

func (a *api) patch(e *core.RequestEvent) error {
	if err := a.requireMembers(e); err != nil {
		return err
	}
	var body struct {
		Name        *string `json:"name"`
		Email       *string `json:"email"`
		Deactivated *bool   `json:"deactivated"`
	}
	if err := decode(e, &body); err != nil {
		return err
	}
	user, err := e.App.FindRecordById("users", e.Request.PathValue("id"))
	if err != nil {
		return e.NotFoundError("", nil)
	}
	summary := map[string]any{}
	if body.Name != nil {
		user.Set("name", strings.TrimSpace(*body.Name))
		summary["name"] = strings.TrimSpace(*body.Name)
	}
	if body.Email != nil {
		user.SetEmail(strings.TrimSpace(*body.Email))
		summary["email"] = strings.TrimSpace(*body.Email)
	}
	if body.Deactivated != nil {
		user.Set("deactivated", *body.Deactivated)
		summary["deactivated"] = *body.Deactivated
	}
	err = e.App.RunInTransaction(func(tx core.App) error {
		if err := tx.Save(user); err != nil {
			return err
		}
		return Log(tx, e.Auth.Id, "update", "users", user.Id, summary)
	})
	if err != nil {
		return e.BadRequestError("The member could not be changed.", err)
	}
	a.logger.Info("member changed", "admin", e.Auth.Id, "member", user.Id)
	return e.JSON(http.StatusOK, memberJSON{ID: user.Id, Name: user.GetString("name"), Email: user.Email(), Deactivated: user.GetBool("deactivated")})
}

func (a *api) setupLink(e *core.RequestEvent) error {
	if err := a.requireMembers(e); err != nil {
		return err
	}
	user, err := e.App.FindRecordById("users", e.Request.PathValue("id"))
	if err != nil {
		return e.NotFoundError("", nil)
	}
	// A link sets a password: for an active admin it would be a takeover of that account.
	rights, err := e.App.CountRecords("admin_rights", dbx.HashExp{"user": user.Id})
	if err != nil {
		return err
	}
	if rights > 0 && !user.GetBool("deactivated") {
		return e.BadRequestError("This member holds admin rights. Deactivate the member first.", nil)
	}
	var out issuedJSON
	err = e.App.RunInTransaction(func(tx core.App) error {
		token, expires, err := issueLink(tx, user.Id, a.now())
		if err != nil {
			return err
		}
		out = issuedJSON{Token: token, Expires: expires.UTC().Format(time.RFC3339)}
		return Log(tx, e.Auth.Id, "update", "users", user.Id, map[string]any{"setupLink": true})
	})
	if err != nil {
		return err
	}
	a.logger.Info("setup link issued", "admin", e.Auth.Id, "member", user.Id)
	return e.JSON(http.StatusOK, out)
}

func randomToken() string {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(raw)
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// issueLink replaces the open links of the user with a new one and returns its token. Only the hash is stored.
func issueLink(app core.App, userID string, now time.Time) (string, time.Time, error) {
	old, err := app.FindAllRecords("setup_links", dbx.HashExp{"user": userID})
	if err != nil {
		return "", time.Time{}, err
	}
	for _, link := range old {
		if err := app.Delete(link); err != nil {
			return "", time.Time{}, err
		}
	}
	collection, err := app.FindCollectionByNameOrId("setup_links")
	if err != nil {
		return "", time.Time{}, err
	}
	token := randomToken()
	expires := now.Add(linkLifetime)
	link := core.NewRecord(collection)
	link.Set("user", userID)
	link.Set("token_hash", hashToken(token))
	link.Set("expires", expires)
	link.Set("used", false)
	return token, expires, app.Save(link)
}
