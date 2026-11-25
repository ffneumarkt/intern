#!/usr/bin/env bash
# Sets up a staging (or any new) environment in one go: directory, .env with fresh VAPID keys, the compose
# file, the default categories / check types / locations, the first admin, and starts everything.
# It can run again: an existing .env and existing data are kept, only what is missing is added.
#
#   ADMIN_EMAIL=chef@example.com deploy/bootstrap-staging.sh
#
# Environment:
#   ADMIN_EMAIL       required; the first admin (all admin areas, manage on every category)
#   ADMIN_NAME        default: ADMIN_EMAIL
#   ADMIN_PASSWORD    default: generated and printed once (only for a user that does not exist yet)
#   SUPERUSER_EMAIL / SUPERUSER_PASSWORD   optional PocketBase superuser for the dashboard (see deploy/README.md)
#   STAGING_DIR       default /srv/intern-staging
#   IMAGE             default ghcr.io/ffneumarkt/intern:latest
#   TUNNEL_TOKEN      Cloudflare tunnel token. Without it no tunnel is started and the app is published on
#                     127.0.0.1:STAGING_PORT (default 8090) instead.
#   VAPID_SUBJECT     default mailto:ADMIN_EMAIL
set -euo pipefail

: "${ADMIN_EMAIL:?set ADMIN_EMAIL to the email of the first admin}"
ADMIN_NAME="${ADMIN_NAME:-$ADMIN_EMAIL}"
STAGING_DIR="${STAGING_DIR:-/srv/intern-staging}"
IMAGE="${IMAGE:-ghcr.io/ffneumarkt/intern:latest}"
STAGING_PORT="${STAGING_PORT:-8090}"
TUNNEL_TOKEN="${TUNNEL_TOKEN:-}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v docker >/dev/null || { echo "docker is needed" >&2; exit 1; }

mkdir -p "$STAGING_DIR/data"
cp "$HERE/../compose.yaml" "$STAGING_DIR/compose.yaml"
cd "$STAGING_DIR"

# The image to run, and no tunnel (so a published loopback port) when there is no token.
{
  echo "services:"
  echo "  intern:"
  echo "    image: $IMAGE"
  if [ -z "$TUNNEL_TOKEN" ]; then
    echo "    ports:"
    echo "      - \"127.0.0.1:$STAGING_PORT:8090\""
    echo "  cloudflared:"
    echo "    profiles: [\"tunnel\"]"
  fi
} > compose.override.yaml

if [ ! -f .env ]; then
  echo "writing .env with new VAPID keys"
  keys="$(docker run --rm "$IMAGE" vapid)"
  umask 077
  {
    echo "TUNNEL_TOKEN=$TUNNEL_TOKEN"
    echo "$keys"
    echo "VAPID_SUBJECT=${VAPID_SUBJECT:-mailto:$ADMIN_EMAIL}"
    echo "LOG_LEVEL=info"
  } > .env
else
  echo ".env exists, kept"
fi

run() { docker compose run --rm -T --no-deps intern "$@" --dir=/pb_data; }

echo "applying migrations and the default setup"
args=(bootstrap --admin-email "$ADMIN_EMAIL" --admin-name "$ADMIN_NAME")
[ -n "${ADMIN_PASSWORD:-}" ] && args+=(--admin-password "$ADMIN_PASSWORD")
run "${args[@]}"

if [ -n "${SUPERUSER_EMAIL:-}" ] && [ -n "${SUPERUSER_PASSWORD:-}" ]; then
  run superuser upsert "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD"
fi

if [ -n "$TUNNEL_TOKEN" ]; then
  docker compose up -d
  echo "started with the tunnel"
else
  docker compose up -d intern
  echo "started: http://127.0.0.1:$STAGING_PORT (passkeys need localhost or the real hostname)"
fi
