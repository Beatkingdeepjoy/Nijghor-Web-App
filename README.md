# Nijghor (নিজঘর / निजघर)

> **Zero-Knowledge Browser-Only Private Messenger**  
> Combines WhatsApp's simplicity with Telegram's speed and features. All chat data lives **only in the user's browser (encrypted IndexedDB)**, never in the cloud. The server is an ephemeral binary relay.

[![CI](https://github.com/nijghor/nijghor/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![License: UNLICENSED](https://img.shields.io/badge/license-UNLICENSED-red.svg)](LICENSE)
[![Protobuf](https://img.shields.io/badge/Protobuf-v3-blue.svg)](proto/)
[![Go](https://img.shields.io/badge/Go-1.22-00ADD8.svg)](server/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](web/)

---

## 1. Key Invariants & Guarantees

1. **Zero-Knowledge Architecture**: The Go server is an ephemeral relay. It stores **zero chat history**, zero plaintext messages, and zero private keys.
2. **Local-Only Encrypted Storage**: All messages, media keys, and rooms live in the browser's IndexedDB via Dexie.js, encrypted field-by-field with **WebCrypto AES-256-GCM** using a master key derived via **Argon2id**.
3. **No Phone Numbers**: Identity is strictly username-based (`@username`). Email is used only for verification and recovery; it is stored as an irreversible cryptographic hash and never shared.
4. **Signal Protocol in Web Worker**: X3DH key exchanges, Double Ratchets, and Sender Keys for groups run off the main thread in a dedicated Web Worker (`crypto.worker.ts`).
5. **Sub-100ms Binary WebSocket Relay**: WebSocket binary Protobuf frames (`nhooyr.io/websocket`) with Redis pub/sub for horizontal multi-server scaling.
6. **Optimistic UI with 4-State House Ticks**:
   - 🕒 **Clock**: Stored in local browser outbox.
   - 🏠 **Outline House**: Sent to server relay.
   - 🏡 **Filled House**: Reached recipient browser.
   - ✨ **Glowing House**: Read by recipient.
7. **PWA & Zero-Content Push**: Installable PWA with VAPID web push notifications containing zero text or sender metadata (empty wake-up ping).
8. **Lock the Door Screen**: Auto-locks after 5 minutes of inactivity; wipes decrypted keys from memory.
9. **Encrypted Backups**: Export and import full chat history as an Argon2id + AES-256-GCM encrypted `.nijghor` local file.

---

## 2. Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS ("Warm Vault" theme), Zustand, TanStack Virtual (60 fps with 10,000+ messages), Dexie.js, Framer Motion, Workbox PWA, react-i18next (English, Bengali, Hindi).
- **Crypto Engine**: Web Worker running Signal Protocol (Curve25519 X3DH + Double Ratchet + Sender Keys), WebCrypto AES-256-GCM, Argon2id WASM.
- **Backend**: Go 1.22, `nhooyr.io/websocket`, Protobuf v3 binary framing, PostgreSQL 16 (accounts & public prekeys only), Redis 7 (ephemeral offline queue with 30-day TTL, presence, rate limits, cross-server pub/sub), MinIO (client-encrypted blobs with 30-day lifecycle auto-purge).
- **Infra**: Docker Compose, Caddy 2.8 (auto HTTPS, HTTP/3 QUIC).

---

## 3. Directory Layout

```text
nijghor/
├── .github/workflows/ci.yml       # Automated CI pipeline
├── proto/                         # Binary Protobuf definitions
│   ├── auth.proto                 # Email code, passkeys, sessions
│   ├── chat.proto                 # WebSocket binary frames & house receipts
│   ├── signal.proto               # Public prekey bundles & Signal envelopes
│   └── sync.proto                 # Offline catchup sync
├── server/                        # Go 1.22 Relay Server
│   ├── cmd/server/main.go         # Entry point & graceful shutdown
│   ├── internal/
│   │   ├── auth/                  # WebAuthn passkeys, email codes, JWT
│   │   ├── config/                # Environment configuration loader
│   │   ├── email/                 # Mock, SMTP, and Resend mailers
│   │   ├── media/                 # Opaque encrypted blob upload/download
│   │   ├── middleware/            # JWT auth, rate limiting, security headers
│   │   ├── models/                # Domain models
│   │   ├── prekey/                # Signal public prekey directory
│   │   ├── push/                  # VAPID zero-content push notifier
│   │   ├── relay/                 # WebSocket hub, Redis pub/sub & offline queue
│   │   └── storage/               # PostgreSQL & Redis connection pools
│   └── Dockerfile
├── web/                           # React 18 + Vite PWA Frontend
│   ├── public/                    # Manifest, favicon, service worker (sw.js)
│   ├── src/
│   │   ├── components/            # UI components (chat, compose, rooms, modals)
│   │   ├── crypto/                # Web Worker RPC bridge
│   │   ├── db/                    # Dexie.js schema, encryption layer, storage
│   │   ├── hooks/                 # Voice recorder, idle lock, shortcuts
│   │   ├── i18n/                  # English, Bengali, Hindi translations
│   │   ├── services/              # WebSocket client, media encryption, backup
│   │   ├── stores/                # Zustand auth & chat stores
│   │   └── workers/               # crypto.worker.ts (WASM Signal & AES-GCM engine)
│   ├── e2e/                       # Playwright test suite
│   └── package.json
├── infra/                         # Production & Local Infrastructure
│   ├── docker-compose.yml         # Postgres, Redis, MinIO, Caddy, Server, Web
│   ├── Caddyfile                  # HTTP/3, auto TLS, reverse proxy, strict CSP
│   └── postgres-init.sql          # Zero-knowledge database schema
├── loadtest/                      # k6 10,000 WebSocket load test script
└── docs/
    ├── ARCHITECTURE.md            # System architecture and framing specs
    ├── THREAT_MODEL.md            # 5-vector comprehensive threat analysis
    └── USER_GUIDE.md              # User guide & keyboard shortcuts
```

---

## 4. Quickstart (Local Run via Docker Compose)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/nijghor.git
cd nijghor

# 2. Copy environment configuration
cp .env.example .env

# 3. Start all services (PostgreSQL, Redis, MinIO, Go Server, Web App, Caddy)
docker compose -f infra/docker-compose.yml up -d

# 4. Open in your browser:
# Frontend Web App: https://localhost or http://localhost:5173
# MinIO Console:    http://localhost:9001 (user: nijghor_minio_admin)
```

---

## 5. Deployment to a Production VPS

1. **Prerequisites**: A modest VPS (2 vCPU, 4GB RAM) with Ubuntu 22.04+, Docker, and Docker Compose installed.
2. **Point DNS**: Configure `A` and `AAAA` DNS records pointing `chat.yourdomain.com` to your VPS IP.
3. **Configure Caddyfile**: Replace `localhost` in [infra/Caddyfile](infra/Caddyfile) with `chat.yourdomain.com`.
4. **Deploy**:
   ```bash
   docker compose -f infra/docker-compose.yml up -d --build
   ```
   Caddy will automatically provision and renew Let's Encrypt TLS certificates and serve the application over HTTP/3 (QUIC).

---

## 6. Testing & Quality Assurance

- **Go Unit Tests**:
  ```bash
  cd server && go test -v ./...
  ```
- **Web App Compilation & Linting**:
  ```bash
  npm --prefix web run lint
  npm --prefix web run build
  ```
- **Playwright End-to-End Tests**:
  ```bash
  npx playwright test
  ```
- **k6 10,000 Concurrent WebSocket Load Test**:
  ```bash
  k6 run loadtest/k6-websocket.js
  ```
