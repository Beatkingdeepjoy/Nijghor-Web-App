# Nijghor System Architecture

Nijghor ("Our Home") is a zero-knowledge, web-only, privacy-first private messenger designed for desktop and mobile browsers.

---

## 1. Zero-Knowledge Threat Model & Data Boundary

```
[ User Browser (Client A) ]                              [ Nijghor Server Relay ]                       [ User Browser (Client B) ]
+----------------------------+                          +--------------------------+                   +----------------------------+
| - Dexie.js (IndexedDB)     |                          | - PostgreSQL 16          |                   | - Dexie.js (IndexedDB)     |
|   Encrypted with AES-GCM   |                          |   * Accounts (@username) |                   |   Encrypted with AES-GCM   |
|   Argon2id Master Key      |                          |   * Public Prekey Bundles|                   |   Argon2id Master Key      |
| - Private Keys (Curve25519)|                          |   * Sessions & WebAuthn  |                   | - Private Keys (Curve25519)|
| - Plaintext Chat History   |                          |   * ZERO CHAT HISTORY    |                   | - Plaintext Chat History   |
| - Crypto Web Worker        |                          |                          |                   | - Crypto Web Worker        |
|   (X3DH, Double Ratchet)   |                          | - Redis 7                |                   |   (X3DH, Double Ratchet)   |
|                            |                          |   * Ephemeral queue      |                   |                            |
|                            | -- Encrypted Protobuf -> |     (30-day TTL, ACKed)  | -- Push/Relay --> |                            |
|                            |    Signal Envelope       |   * Presence & Rate-limit|    Encrypted Frame|                            |
|                            |                          |                          |                   |                            |
|                            | -- Encrypted Blob -----> | - MinIO / Cloudflare R2  |                   |                            |
|                            |    (Client AES key)      |   * Auto-delete in 30 d  |                   |                            |
+----------------------------+                          +--------------------------+                   +----------------------------+
```

### Core Privacy Guarantees
1. **Server Never Sees Plaintext**: All end-to-end encryption takes place inside `crypto.worker.ts` using the Signal Protocol (X3DH for session initiation, Double Ratchet for conversation forward-secrecy, Sender Keys for groups up to 256 members).
2. **Local-Only Database**: Chat history is stored solely inside the user's browser IndexedDB via Dexie.js. The records are encrypted field-by-field with WebCrypto AES-256-GCM.
3. **No Phone Numbers**: Identity is purely username-based (`@username`). Email is only used for verification and recovery; it is stored as an Argon2id/SHA-256 hash and never shared with other users.
4. **Zero-Content Web Push**: Web Push payloads contain no sender name, room title, or text. The push is an empty wake-up ping. The service worker retrieves the encrypted envelope, decrypts it locally, and displays the notification.
5. **Auto-Purge Relay**: The server's Redis queue only holds undelivered messages. Once the recipient sends a `MessageAck`, the envelope is purged immediately. Uncollected messages expire after 30 days.

---

## 2. Directory Structure

```text
nijghor/
├── .github/workflows/ci.yml       # Automated CI test and build matrix
├── proto/                         # Binary Protobuf definitions
│   ├── auth.proto                 # Authentication, email code, WebAuthn, sessions
│   ├── chat.proto                 # WebSocket frames, receipts, typing, presence
│   ├── signal.proto               # Prekey bundles, X3DH envelopes, ratchets
│   └── sync.proto                 # Offline synchronization
├── server/                        # Go 1.22 Relay Backend
│   ├── cmd/server/main.go         # Server entrypoint
│   ├── internal/
│   │   ├── auth/                  # Password, WebAuthn, JWT, email codes
│   │   ├── config/                # Environment configuration loader
│   │   ├── email/                 # Mock, SMTP, and Resend mailers
│   │   ├── media/                 # Encrypted blob upload/download handlers
│   │   ├── models/                # Database entities
│   │   ├── push/                  # VAPID web push notifier
│   │   ├── relay/                 # nhooyr/websocket hub & Redis pub/sub
│   │   └── storage/               # PostgreSQL & Redis connection pools
│   ├── Dockerfile
│   └── go.mod
├── web/                           # React 18 + Vite PWA Frontend
│   ├── public/                    # Manifest, sound chimes, icons
│   ├── src/
│   │   ├── components/            # UI components (virtualized lists, compose bar)
│   │   ├── crypto/                # Web Worker client, AES-GCM, Argon2id
│   │   ├── db/                    # Dexie.js schema, encrypted tables, outbox
│   │   ├── hooks/                 # WebSocket hook, keyboard shortcuts, media recorder
│   │   ├── i18n/                  # English, Bengali, Hindi translations
│   │   ├── stores/                # Zustand state stores
│   │   └── workers/               # crypto.worker.ts (WASM Signal engine)
│   ├── Dockerfile
│   └── package.json
├── infra/                         # Production & Local Infrastructure
│   ├── docker-compose.yml         # Postgres, Redis, MinIO, Caddy, Server, Web
│   ├── Caddyfile                  # HTTP/3, auto TLS, reverse proxy, strict CSP
│   └── postgres-init.sql          # Postgres initial zero-knowledge schema
└── docs/                          # Guides & Threat Model
    ├── ARCHITECTURE.md
    └── THREAT_MODEL.md
```

---

## 3. Communication Protocol (Protobuf over WebSocket)

- WebSocket endpoint: `/ws`
- Framing: Binary Protobuf `nijghor.chat.Frame`
- Connection Lifecycle:
  1. Client opens WebSocket connection.
  2. Client sends `AuthHandshake` with JWT access token and `last_received_seq`.
  3. Server validates JWT, registers connection in local hub and Redis presence set, responds with `AuthHandshakeAck`.
  4. Server flushes any pending offline messages from Redis with monotonic sequence IDs.
  5. Bidirectional exchange: `SendMessage`, `ReceiveMessage`, `MessageAck`, `DeliveryReceipt`, `TypingIndicator`, `PresenceUpdate`.
  6. Heartbeat: Periodic `Ping` / `Pong` every 25 seconds with 5-second deadline.

---

## 4. House-Icon Receipt Lifecycle

- **Clock Icon (Optimistic)**: Saved to browser IndexedDB `outbox`, waiting to hit the network.
- **Single Outline House (Sent)**: WebSocket server received the frame and acknowledged with `MessageAck`.
- **Filled House (Delivered)**: Recipient browser received the envelope and fired `DeliveryReceipt` with status `RECEIPT_STATUS_DELIVERED`.
- **Glowing House (Read)**: Recipient opened the room view, triggering `DeliveryReceipt` with status `RECEIPT_STATUS_READ`.
