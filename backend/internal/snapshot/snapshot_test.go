package snapshot_test

import (
	"bytes"
	"compress/gzip"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/pocketbase/pocketbase/core"

	"github.com/ffneumarkt/intern/backend/internal/snapshot"
)

func seededDB(t *testing.T, dir string) string {
	t.Helper()
	path := filepath.Join(dir, "data.db")
	db, err := core.DefaultDBConnect(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.NewQuery("CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT)").Execute(); err != nil {
		t.Fatal(err)
	}
	for _, body := range []string{"eins", "zwei", "drei"} {
		if _, err := db.NewQuery("INSERT INTO notes (body) VALUES ({:b})").Bind(map[string]any{"b": body}).Execute(); err != nil {
			t.Fatal(err)
		}
	}
	return path
}

func restore(t *testing.T, gz []byte) []string {
	t.Helper()
	zr, err := gzip.NewReader(bytes.NewReader(gz))
	if err != nil {
		t.Fatal(err)
	}
	raw, err := io.ReadAll(zr)
	if err != nil {
		t.Fatal(err)
	}
	restored := filepath.Join(t.TempDir(), "restored.db")
	if err := os.WriteFile(restored, raw, 0o600); err != nil {
		t.Fatal(err)
	}
	db, err := core.DefaultDBConnect(restored)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var bodies []string
	if err := db.NewQuery("SELECT body FROM notes ORDER BY id").Column(&bodies); err != nil {
		t.Fatal(err)
	}
	return bodies
}

func TestWriteRestoresToIdenticalData(t *testing.T) {
	dir := t.TempDir()
	path := seededDB(t, dir)
	var out bytes.Buffer
	if err := snapshot.Write(path, &out); err != nil {
		t.Fatal(err)
	}
	got := restore(t, out.Bytes())
	if len(got) != 3 || got[0] != "eins" || got[2] != "drei" {
		t.Fatalf("restored rows = %v", got)
	}
}

func TestWriteLeavesNoTemporaryFile(t *testing.T) {
	dir := t.TempDir()
	path := seededDB(t, dir)
	before, _ := os.ReadDir(dir)
	if err := snapshot.Write(path, io.Discard); err != nil {
		t.Fatal(err)
	}
	after, _ := os.ReadDir(dir)
	if len(after) != len(before) {
		t.Fatalf("directory changed: %d files before, %d after", len(before), len(after))
	}
}

func TestWriteFailsForAMissingDatabaseWithoutCreatingIt(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data.db")
	if err := snapshot.Write(path, io.Discard); err == nil {
		t.Fatal("expected an error")
	}
	if _, err := os.Stat(path); err == nil {
		t.Fatal("snapshot created the database")
	}
}
