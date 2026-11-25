package admin

import (
	"crypto/subtle"
	"net/http"
	"unicode/utf8"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// minPasswordLength is the shortest password a member can choose through a setup link.
const minPasswordLength = 10

// noReferrer keeps the address of the setup page, and so the link, from leaving with any request.
func noReferrer(e *core.RequestEvent) error {
	e.Response.Header().Set("Referrer-Policy", "no-referrer")
	return e.Next()
}

// badLink is the one answer for every link that does not work: unknown, expired, used, or of a
// deactivated member.
func badLink(e *core.RequestEvent) error {
	return e.BadRequestError("The link is invalid or has expired.", nil)
}

// openLink finds the link of the token and the member it belongs to, when it can still be used.
func (a *api) openLink(app core.App, token string) (link, user *core.Record) {
	if token == "" {
		return nil, nil
	}
	hash := hashToken(token)
	link, err := app.FindFirstRecordByFilter("setup_links", "token_hash = {:hash}", dbx.Params{"hash": hash})
	if err != nil || subtle.ConstantTimeCompare([]byte(link.GetString("token_hash")), []byte(hash)) != 1 {
		return nil, nil
	}
	if link.GetBool("used") || !link.GetDateTime("expires").Time().After(a.now()) {
		return nil, nil
	}
	user, err = app.FindRecordById("users", link.GetString("user"))
	if err != nil || user.GetBool("deactivated") {
		return nil, nil
	}
	return link, user
}

func (a *api) checkLink(e *core.RequestEvent) error {
	var body struct {
		Token string `json:"token"`
	}
	if err := decode(e, &body); err != nil {
		return err
	}
	_, user := a.openLink(e.App, body.Token)
	if user == nil {
		return badLink(e)
	}
	return e.JSON(http.StatusOK, map[string]string{"name": user.GetString("name")})
}

func (a *api) completeLink(e *core.RequestEvent) error {
	var body struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := decode(e, &body); err != nil {
		return err
	}
	link, user := a.openLink(e.App, body.Token)
	if user == nil {
		return badLink(e)
	}
	if utf8.RuneCountInString(body.Password) < minPasswordLength {
		return e.BadRequestError("The password is too short.", nil)
	}
	err := e.App.RunInTransaction(func(tx core.App) error {
		user.SetPassword(body.Password)
		if err := tx.Save(user); err != nil {
			return err
		}
		link.Set("used", true)
		return tx.Save(link)
	})
	if err != nil {
		return err
	}
	a.logger.Info("member set a password through a setup link", "member", user.Id)
	return e.NoContent(http.StatusNoContent)
}
