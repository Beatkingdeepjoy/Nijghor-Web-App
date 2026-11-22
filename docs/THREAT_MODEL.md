# Nijghor Threat Model & Security Architecture

Version: 1.0  
Date: November 2026  
Status: Production Grade Zero-Knowledge Architecture

---

## 1. Executive Summary & Zero-Knowledge Boundary

Nijghor is designed under a **Zero-Knowledge Relay Architecture**:
- All private cryptographic keys (Curve25519 identity, signed prekeys, one-time prekeys, Double Ratchet states, and AES-GCM data encryption keys) reside exclusively within the user's browser runtime.
- The server is an ephemeral binary packet relay. The server database stores **only** public prekey bundles, hashed account records, WebAuthn public credentials, and active session tokens.
- Undelivered encrypted messages wait in Redis with a strict 30-day TTL and are deleted immediately upon recipient delivery ACK.

---

## 2. Threat Analysis Across 5 Attack Vectors

### Vector 1: Stolen Laptop / Physical Device Seizure
* **Threat**: An adversary gains physical control of an unlocked computer or steals an unencrypted laptop while the browser is closed.
* **Mitigations**:
  1. **Lock the Door Screen**: Inactivity for 5 minutes automatically purges the volatile `masterDataKey` and in-memory Double Ratchet session states from Web Worker memory.
  2. **At-Rest Field-Level Encryption**: All sensitive fields in Dexie.js (chat history, contact notes, draft outbox, media keys) are encrypted with WebCrypto AES-256-GCM using a key derived via Argon2id from the user's secret PIN/passphrase.
  3. **Zero Plaintext on Disk**: Even if an attacker inspects raw LevelDB/IndexedDB files on disk, they observe only ciphertext with 12-byte random IVs and 128-bit authentication tags.
  4. **Volatile Key Invariant**: The decrypted master encryption key is never written to `localStorage`, `sessionStorage`, cookies, or IndexedDB.

### Vector 2: Malicious or Compromised Server Relay
* **Threat**: A rogue server operator, subpoena, or compromised cloud provider inspects server memory, network traffic, PostgreSQL databases, and Redis queues.
* **Mitigations**:
  1. **End-to-End Encryption (E2EE)**: All message envelopes are encrypted with the Signal Protocol (X3DH + Double Ratchet + Sender Keys). The server relay sees only opaque binary Protobuf frames.
  2. **Forward Secrecy & Break-in Recovery**: Every message ratchet derives a fresh message key via HMAC-SHA256 and deletes it immediately after encryption/decryption. Compromise of a future key cannot decrypt past messages.
  3. **Client-Side Media Encryption**: Photos, videos, and voice notes are compressed and encrypted client-side using random 256-bit symmetric keys. The symmetric key is transmitted only inside the ratchet envelope. MinIO/S3 stores only encrypted binary blobs with a 30-day lifecycle auto-purge.
  4. **Zero-Content Web Push**: Web Push notifications contain zero payload data (no sender name, room title, or text). Notifications act as an empty wake-up ping.

### Vector 3: Cross-Site Scripting (XSS) & Content Injection
* **Threat**: An attacker attempts to inject malicious JavaScript into room titles, message bodies, or media attachments.
* **Mitigations**:
  1. **Strict Content Security Policy (CSP)**:
     ```text
     default-src 'self';
     script-src 'self' 'wasm-unsafe-eval';
     style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
     font-src 'self' https://fonts.gstatic.com data:;
     connect-src 'self' ws: wss: http: https: blob:;
     worker-src 'self' blob:;
     frame-ancestors 'none';
     ```
  2. **React Auto-Escaping**: All text rendered inside `MessageBubble` is rendered through React's native string interpolation, preventing raw HTML injection.
  3. **Web Worker Cryptographic Isolation**: Even in the theoretical event of DOM execution, cryptographic keys and ratchets reside in a dedicated Web Worker (`crypto.worker.ts`) isolated from DOM access.
  4. **Media Sniffing Safeguards**: All uploaded media blobs are served with `Content-Type: application/octet-stream` and `X-Content-Type-Options: nosniff`.

### Vector 4: Browser Storage Eviction & Cache Clearing
* **Threat**: The operating system or browser runs low on disk space and silently wipes IndexedDB data, or the user clears browser history.
* **Mitigations**:
  1. **Persistent Storage Request**: Nijghor invokes `navigator.storage.persist()` on onboarding, instructing the browser engine never to evict IndexedDB storage automatically.
  2. **Storage Quota Monitoring**: `checkStorageQuota()` queries `navigator.storage.estimate()` and displays early warning toasts when storage exceeds 80%.
  3. **Encrypted `.nijghor` Backups**: Users are periodically prompted to download an Argon2id + AES-256-GCM encrypted `.nijghor` backup container to local disk.
  4. **Transparent New-Browser Warning**: When signing in on a new device, the UI explicitly and kindly explains that chat history is stored locally in the previous browser and must be restored via backup file.

### Vector 5: Email Takeover / Recovery Attack
* **Threat**: An attacker hijacks the user's email account and attempts to use the email verification code flow to take over the account and read past chats.
* **Mitigations**:
  1. **Zero-Knowledge History Invariant**: Even if an attacker receives an email verification code and logs into the account on a new browser, **they will see zero past chat history**. Past messages exist only in the authentic user's local browser database.
  2. **No Cloud Key Backup**: Private keys are never backed up to the cloud. Without the physical device or the encrypted `.nijghor` backup file + passphrase, the attacker has an empty inbox.
  3. **Rate Limiting & Expiry**: Email verification codes expire in 10 minutes, allow a maximum of 5 attempts, and are rate-limited per email and IP address in Redis.
  4. **Hashed Email Storage**: Emails are stored as irreversible cryptographic hashes on the server, preventing contact correlation or discovery.

---

## 3. Cryptographic Primitives Summary

| Purpose | Primitive / Algorithm | Standard / Library |
|---|---|---|
| **Asymmetric Key Exchange** | X3DH (Curve25519 / ECDH) | Signal Protocol Spec / WebCrypto P-256 |
| **Symmetric Ratchet** | HMAC-SHA256 + HKDF | RFC 5869 |
| **Payload Encryption** | AES-256-GCM (96-bit IV) | NIST SP 800-38D |
| **Local DB Master Key** | Argon2id (WASM) / PBKDF2 150k | RFC 9106 |
| **Group Messaging** | Sender Keys Protocol | Signal Group Messaging |
| **Out-of-band Verification** | Safety Numbers (SHA-512) | 60 digits (12 blocks of 5) |
| **Backup Encryption** | AES-256-GCM + Argon2id | `.nijghor` binary container |
