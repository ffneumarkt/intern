package snapshot

import (
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/pocketbase/pocketbase/core"
)

// Write streams a gzipped, consistent copy of the SQLite database at dbPath to w. The copy is made
// with VACUUM INTO in a temporary directory next to the database, which is removed afterwards, so a
// running server keeps working and nothing is left behind. The database must exist.
func Write(dbPath string, w io.Writer) error {
	if _, err := os.Stat(dbPath); err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	tmp, err := os.MkdirTemp(filepath.Dir(dbPath), "snapshot-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmp)

	copyPath := filepath.Join(tmp, "copy.db")
	db, err := core.DefaultDBConnect(dbPath)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	_, err = db.NewQuery("VACUUM INTO {:path}").Bind(map[string]any{"path": copyPath}).Execute()
	db.Close()
	if err != nil {
		return fmt.Errorf("copy database: %w", err)
	}

	f, err := os.Open(copyPath)
	if err != nil {
		return err
	}
	defer f.Close()
	zw := gzip.NewWriter(w)
	if _, err := io.Copy(zw, f); err != nil {
		return err
	}
	return zw.Close()
}
