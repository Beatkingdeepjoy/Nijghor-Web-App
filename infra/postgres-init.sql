-- PostgreSQL Schema for Nijghor Server Relay
-- Zero-Knowledge Architecture: Server stores ONLY accounts, public keys, and sessions.
-- NEVER stores chat history, message content, private keys, or contact address books.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Accounts
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(32) UNIQUE NOT NULL,
    email_hash VARCHAR(128) NOT NULL, -- SHA-256 / Argon2id hash of normalized email for lookup
    password_hash VARCHAR(255),       -- Argon2id hash (empty if WebAuthn-only)
    auth_type VARCHAR(16) NOT NULL DEFAULT 'PASSWORD', -- 'PASSWORD' or 'WEBAUTHN'
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',      -- 'ACTIVE', 'SUSPENDED', 'DELETED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);

-- 2. WebAuthn Passkey Credentials
CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id BYTEA UNIQUE NOT NULL,
    public_key BYTEA NOT NULL,
    attestation_type VARCHAR(32) NOT NULL DEFAULT 'none',
    aaguid BYTEA,
    sign_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webauthn_user_id ON webauthn_credentials(user_id);

-- 3. Ephemeral Email Verification Codes (Max 10 min TTL, Max 5 attempts)
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_hash VARCHAR(128) NOT NULL,
    code_hash VARCHAR(128) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_lookup ON email_verifications(email_hash, expires_at);

-- 4. User Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(128) NOT NULL,
    device_hint VARCHAR(128) NOT NULL DEFAULT 'Web Browser',
    ip_address VARCHAR(45) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_hash ON sessions(refresh_token_hash);

-- 5. Signal Prekey Bundles (Public Keys ONLY)
CREATE TABLE IF NOT EXISTS prekey_bundles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    registration_id BIGINT NOT NULL,
    identity_key BYTEA NOT NULL,           -- Ed25519/Curve25519 public key
    signed_prekey_id BIGINT NOT NULL,
    signed_prekey BYTEA NOT NULL,          -- Curve25519 public key
    signed_prekey_signature BYTEA NOT NULL,-- Signature over signed_prekey by identity_key
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Signal One-Time Prekeys (Depleted on fetch)
CREATE TABLE IF NOT EXISTS one_time_prekeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id BIGINT NOT NULL,
    public_key BYTEA NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otpk_available ON one_time_prekeys(user_id, used);

-- 7. Minimal Room Membership (for group relay fanout ONLY - zero message history)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(16) NOT NULL DEFAULT 'DIRECT', -- 'DIRECT' or 'GROUP'
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_members (
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL DEFAULT 'MEMBER', -- 'ADMIN', 'MEMBER'
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
