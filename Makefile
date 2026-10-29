.PHONY: dev-api dev-web test build image run

dev-api:
	cd backend && go run ./cmd/intern serve

dev-web:
	npm --prefix web run dev

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
