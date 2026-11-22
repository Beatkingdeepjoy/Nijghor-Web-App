package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Username     string    `json:"username"`
	EmailHash    string    `json:"-"`
	PasswordHash string    `json:"-"`
	AuthType     string    `json:"auth_type"` // "PASSWORD", "WEBAUTHN"
	Status       string    `json:"status"`    // "ACTIVE", "DELETED"
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Session struct {
	ID               uuid.UUID  `json:"id"`
	UserID           uuid.UUID  `json:"user_id"`
	RefreshTokenHash string     `json:"-"`
	DeviceHint       string     `json:"device_hint"`
	IPAddress        string     `json:"ip_address"`
	CreatedAt        time.Time  `json:"created_at"`
	LastActiveAt     time.Time  `json:"last_active_at"`
	ExpiresAt        time.Time  `json:"expires_at"`
	RevokedAt        *time.Time `json:"revoked_at,omitempty"`
	IsCurrent        bool       `json:"is_current"`
}

type EmailVerification struct {
	ID        uuid.UUID `json:"id"`
	EmailHash string    `json:"email_hash"`
	CodeHash  string    `json:"-"`
	Attempts  int       `json:"attempts"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

type WebAuthnCredential struct {
	ID              uuid.UUID  `json:"id"`
	UserID          uuid.UUID  `json:"user_id"`
	CredentialID    []byte     `json:"credential_id"`
	PublicKey       []byte     `json:"public_key"`
	AttestationType string     `json:"attestation_type"`
	AAGUID          []byte     `json:"aaguid"`
	SignCount       uint32     `json:"sign_count"`
	CreatedAt       time.Time  `json:"created_at"`
	LastUsedAt      *time.Time `json:"last_used_at,omitempty"`
}

type PrekeyBundle struct {
	UserID                 uuid.UUID `json:"user_id"`
	RegistrationID         uint32    `json:"registration_id"`
	IdentityKey            []byte    `json:"identity_key"`
	SignedPrekeyID         uint32    `json:"signed_prekey_id"`
	SignedPrekey           []byte    `json:"signed_prekey"`
	SignedPrekeySignature  []byte    `json:"signed_prekey_signature"`
	UpdatedAt              time.Time `json:"updated_at"`
}

type OneTimePrekey struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	KeyID     uint32    `json:"key_id"`
	PublicKey []byte    `json:"public_key"`
	Used      bool      `json:"used"`
	CreatedAt time.Time `json:"created_at"`
}
