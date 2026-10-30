package passkey

import (
	"os"
	"strings"
)

const (
	defaultRPID   = "intern.ffneumarkt.at"
	defaultOrigin = "https://intern.ffneumarkt.at"
)

// Config says which site passkeys belong to.
type Config struct {
	RPID    string
	Origins []string
}

// ConfigFromEnv reads PASSKEY_RP_ID and PASSKEY_ORIGIN (comma separated). WebAuthn does not accept
// an IP address, so local development runs on localhost.
func ConfigFromEnv() Config {
	cfg := Config{RPID: defaultRPID, Origins: []string{defaultOrigin}}
	if id := os.Getenv("PASSKEY_RP_ID"); id != "" {
		cfg.RPID = id
	}
	if origins := os.Getenv("PASSKEY_ORIGIN"); origins != "" {
		cfg.Origins = nil
		for origin := range strings.SplitSeq(origins, ",") {
			cfg.Origins = append(cfg.Origins, strings.TrimSpace(origin))
		}
	}
	return cfg
}
