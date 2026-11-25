# Handy commands for a server. Copy this file next to compose.yaml and .env (for example /opt/ff) and run `make`.
# Recipe lines must start with a tab.
.DEFAULT_GOAL := help
.PHONY: help update up down restart logs ps first-user vapid

help: ## Show these commands
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | sed -E 's/:.*## /\t/'

update: ## Pull the newest image and restart what changed, then remove old images
	docker compose up -d --pull always --remove-orphans
	docker image prune -f

up: ## Start (or apply changes of compose.yaml and .env) without pulling
	docker compose up -d --remove-orphans

down: ## Stop and remove the containers (the data in ./data stays)
	docker compose down

restart: ## Restart the app only
	docker compose restart intern

logs: ## Follow the logs of all services
	docker compose logs -f --tail=100

ps: ## Show the running services
	docker compose ps

# make first-user ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name"
# Makes the user (a password is printed once) an admin of everything and adds the default setup if it is missing.
first-user: ## Create the first admin: make first-user ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name"
	@test -n "$(ADMIN_EMAIL)" || { echo "set ADMIN_EMAIL=you@example.com" >&2; exit 1; }
	docker compose exec intern /intern bootstrap --admin-email "$(ADMIN_EMAIL)" --admin-name "$(or $(ADMIN_NAME),$(ADMIN_EMAIL))"

vapid: ## Print a new VAPID key pair for .env
	docker run --rm ghcr.io/ffneumarkt/intern vapid
