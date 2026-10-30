.PHONY: dev-api dev-web debug seed test build image run

# Runs backend and frontend together with debug logging; Ctrl-C stops both.
debug:
	LOG_LEVEL=debug $(MAKE) -j2 dev-api dev-web

dev-api:
	cd backend && go run ./cmd/intern serve

dev-web:
	npm --prefix web run dev

# Fills backend/pb_data with sample data; does nothing if it already has categories.
seed:
	cd backend && go run ./cmd/seed

test:
	cd backend && go vet ./... && go test ./...
	npm --prefix web run typecheck
	npm --prefix web test

# Builds the frontend into backend/ui/dist and the binary to backend/intern.
build:
	npm --prefix web run build
	cd backend && CGO_ENABLED=0 go build -o intern ./cmd/intern

image:
	docker build -t intern:local .

run:
	docker run --rm -p 8090:8090 -v $(CURDIR)/pb_data:/pb_data intern:local
