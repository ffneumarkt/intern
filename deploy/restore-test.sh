#!/bin/sh
# Restore test for a backup: checks the SQLite file and starts the app on it.
#   ./restore-test.sh intern-2026-11-24.db.gz
# Needs docker, gzip, curl and sqlite3. Starts the published image with the restored copy on
# 127.0.0.1:8099 (host network, bound to loopback, no published port) and stops it again; nothing
# on the VPS is touched.
set -eu
[ $# -eq 1 ] || { echo "usage: $0 BACKUP.db.gz" >&2; exit 2; }
work=$(mktemp -d)
name=intern-restore-test
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT

gzip -dc "$1" > "$work/data.db"
[ "$(sqlite3 "$work/data.db" 'PRAGMA integrity_check;')" = ok ] || { echo "integrity_check failed" >&2; exit 1; }
echo "items: $(sqlite3 "$work/data.db" 'SELECT count(*) FROM items;')"
echo "users: $(sqlite3 "$work/data.db" 'SELECT count(*) FROM users;')"

# The container runs as root, so it may write next to the copy.
docker run -d --name "$name" --network host -v "$work:/pb_data" "${IMAGE:-ghcr.io/ffneumarkt/intern:latest}" serve --http=127.0.0.1:8099 --dir=/pb_data >/dev/null
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8099/api/health >/dev/null 2>&1; then echo "app started on the restored data"; exit 0; fi
  sleep 1
done
echo "app did not become healthy" >&2
docker logs "$name" >&2
exit 1
