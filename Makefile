.PHONY: dev-api dev-web debug seed test e2e build image run

# Runs backend and frontend together with debug logging; Ctrl-C stops both.
debug:
	LOG_LEVEL=debug $(MAKE) -j2 dev-api dev-web

# Passkeys need the name localhost, not an IP. They work on the Vite server (:5173) and on the
# backend serving the built app (:8090).
dev-api:
	cd backend && PASSKEY_RP_ID=localhost PASSKEY_ORIGIN=http://localhost:5173,http://localhost:8090 go run ./cmd/intern serve

dev-web:
	npm --prefix web run dev

# Fills backend/pb_data with sample data; does nothing if it already has categories.
seed:
	cd backend && go run ./cmd/seed

test:
	cd backend && go vet ./... && go test ./...
	npm --prefix web run typecheck
	npm --prefix web test

# Real-browser tests (Playwright) against the built binary with a seeded temporary data dir.
e2e:
	npm --prefix web run e2e

# Builds the frontend into backend/ui/dist and the binary to backend/intern.
build:
	npm --prefix web run build
	cd backend && CGO_ENABLED=0 go build -o intern ./cmd/intern

image:
	docker build -t intern:local .

run:
	docker run --rm -p 8090:8090 -v $(CURDIR)/pb_data:/pb_data intern:local
