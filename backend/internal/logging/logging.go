// Package logging creates the application logger (charmbracelet/log).
package logging

import (
	"os"

	"github.com/charmbracelet/log"
)

// ParseLevel maps a level name like "debug" or "WARN" to a log level; unknown or empty names give info.
func ParseLevel(name string) log.Level {
	level, err := log.ParseLevel(name)
	if err != nil {
		return log.InfoLevel
	}
	return level
}

// New returns a logger writing to stderr at the given level name.
func New(levelName string) *log.Logger {
	return log.NewWithOptions(os.Stderr, log.Options{
		ReportCaller:    true,
		ReportTimestamp: true,
		TimeFormat:      "15:04:05.00",
		Level:           ParseLevel(levelName),
	})
}
