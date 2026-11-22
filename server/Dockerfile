# Multi-stage Dockerfile for Nijghor Go 1.22 Relay Server
FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

COPY server/go.mod ./
RUN go mod download || true

COPY proto/ /proto/
COPY server/ ./

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /bin/nijghor-server ./cmd/server

# Final Minimal Distroless / Scratch Runtime
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata curl

WORKDIR /app
COPY --from=builder /bin/nijghor-server /app/nijghor-server

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/nijghor-server"]
