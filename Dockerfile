# Frontend: Vite builds into ../backend/ui/dist.
FROM node:26-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN mkdir -p ../backend/ui/dist && npm run build

# Backend: single static binary with the frontend embedded.
FROM golang:1.27-alpine AS backend
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=web /src/backend/ui/dist ./ui/dist
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /intern ./cmd/intern

FROM gcr.io/distroless/static
LABEL org.opencontainers.image.source=https://github.com/ffneumarkt/intern
COPY --from=backend /intern /intern
VOLUME /pb_data
EXPOSE 8090
ENTRYPOINT ["/intern"]
CMD ["serve", "--http=0.0.0.0:8090", "--dir=/pb_data"]
