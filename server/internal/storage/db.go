package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"nijghor/server/internal/models"
)

type Database struct {
	Pool *pgxpool.Pool
}

func NewDatabase(ctx context.Context, connString string) (*Database, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("parse db config: %w", err)
	}

	config.MaxConns = 50
	config.MinConns = 5
	config.MaxConnLifetime = 1 * time.Hour
	config.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create db pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	return &Database{Pool: pool}, nil
}

func (db *Database) Close() {
	if db.Pool != nil {
		db.Pool.Close()
	}
}

// ----------------- User Store -----------------

func (db *Database) CreateUser(ctx context.Context, u *models.User) error {
	query := `
		INSERT INTO users (id, username, email_hash, password_hash, auth_type, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := db.Pool.Exec(ctx, query, u.ID, u.Username, u.EmailHash, u.PasswordHash, u.AuthType, u.Status, u.CreatedAt, u.UpdatedAt)
	return err
}

func (db *Database) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	query := `
		SELECT id, username, email_hash, password_hash, auth_type, status, created_at, updated_at
		FROM users
		WHERE LOWER(username) = LOWER($1) AND status != 'DELETED'
		LIMIT 1
	`
	var u models.User
	err := db.Pool.QueryRow(ctx, query, username).Scan(
		&u.ID, &u.Username, &u.EmailHash, &u.PasswordHash, &u.AuthType, &u.Status, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (db *Database) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	query := `
		SELECT id, username, email_hash, password_hash, auth_type, status, created_at, updated_at
		FROM users
		WHERE id = $1 AND status != 'DELETED'
		LIMIT 1
	`
	var u models.User
	err := db.Pool.QueryRow(ctx, query, id).Scan(
		&u.ID, &u.Username, &u.EmailHash, &u.PasswordHash, &u.AuthType, &u.Status, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (db *Database) GetUserByEmailHash(ctx context.Context, emailHash string) (*models.User, error) {
	query := `
		SELECT id, username, email_hash, password_hash, auth_type, status, created_at, updated_at
		FROM users
		WHERE email_hash = $1 AND status != 'DELETED'
		LIMIT 1
	`
	var u models.User
	err := db.Pool.QueryRow(ctx, query, emailHash).Scan(
		&u.ID, &u.Username, &u.EmailHash, &u.PasswordHash, &u.AuthType, &u.Status, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (db *Database) DeleteUser(ctx context.Context, userID uuid.UUID) error {
	// Cascades to prekeys, sessions, credentials via ON DELETE CASCADE
	query := `UPDATE users SET status = 'DELETED', updated_at = NOW() WHERE id = $1`
	_, err := db.Pool.Exec(ctx, query, userID)
	return err
}

// ----------------- Email Verifications -----------------

func (db *Database) SaveEmailVerification(ctx context.Context, ev *models.EmailVerification) error {
	query := `
		INSERT INTO email_verifications (id, email_hash, code_hash, attempts, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := db.Pool.Exec(ctx, query, ev.ID, ev.EmailHash, ev.CodeHash, ev.Attempts, ev.ExpiresAt, ev.CreatedAt)
	return err
}

func (db *Database) GetLatestEmailVerification(ctx context.Context, emailHash string) (*models.EmailVerification, error) {
	query := `
		SELECT id, email_hash, code_hash, attempts, expires_at, created_at
		FROM email_verifications
		WHERE email_hash = $1 AND expires_at > NOW()
		ORDER BY created_at DESC
		LIMIT 1
	`
	var ev models.EmailVerification
	err := db.Pool.QueryRow(ctx, query, emailHash).Scan(
		&ev.ID, &ev.EmailHash, &ev.CodeHash, &ev.Attempts, &ev.ExpiresAt, &ev.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &ev, nil
}

func (db *Database) IncrementVerificationAttempts(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1`
	_, err := db.Pool.Exec(ctx, query, id)
	return err
}

func (db *Database) DeleteEmailVerifications(ctx context.Context, emailHash string) error {
	query := `DELETE FROM email_verifications WHERE email_hash = $1`
	_, err := db.Pool.Exec(ctx, query, emailHash)
	return err
}

// ----------------- Sessions -----------------

func (db *Database) CreateSession(ctx context.Context, s *models.Session) error {
	query := `
		INSERT INTO sessions (id, user_id, refresh_token_hash, device_hint, ip_address, created_at, last_active_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := db.Pool.Exec(ctx, query, s.ID, s.UserID, s.RefreshTokenHash, s.DeviceHint, s.IPAddress, s.CreatedAt, s.LastActiveAt, s.ExpiresAt)
	return err
}

func (db *Database) GetSessionByID(ctx context.Context, id uuid.UUID) (*models.Session, error) {
	query := `
		SELECT id, user_id, refresh_token_hash, device_hint, ip_address, created_at, last_active_at, expires_at, revoked_at
		FROM sessions
		WHERE id = $1
		LIMIT 1
	`
	var s models.Session
	err := db.Pool.QueryRow(ctx, query, id).Scan(
		&s.ID, &s.UserID, &s.RefreshTokenHash, &s.DeviceHint, &s.IPAddress, &s.CreatedAt, &s.LastActiveAt, &s.ExpiresAt, &s.RevokedAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (db *Database) GetSessionsByUserID(ctx context.Context, userID uuid.UUID, currentSessionID uuid.UUID) ([]models.Session, error) {
	query := `
		SELECT id, user_id, device_hint, ip_address, created_at, last_active_at, expires_at, revoked_at
		FROM sessions
		WHERE user_id = $1 AND (revoked_at IS NULL AND expires_at > NOW())
		ORDER BY last_active_at DESC
	`
	rows, err := db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []models.Session
	for rows.Next() {
		var s models.Session
		if err := rows.Scan(&s.ID, &s.UserID, &s.DeviceHint, &s.IPAddress, &s.CreatedAt, &s.LastActiveAt, &s.ExpiresAt, &s.RevokedAt); err != nil {
			return nil, err
		}
		s.IsCurrent = (s.ID == currentSessionID)
		sessions = append(sessions, s)
	}
	return sessions, nil
}

func (db *Database) RevokeSession(ctx context.Context, sessionID uuid.UUID, userID uuid.UUID) error {
	query := `UPDATE sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2`
	_, err := db.Pool.Exec(ctx, query, sessionID, userID)
	return err
}

func (db *Database) RevokeOtherSessions(ctx context.Context, userID uuid.UUID, currentSessionID uuid.UUID) error {
	query := `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND id != $2 AND revoked_at IS NULL`
	_, err := db.Pool.Exec(ctx, query, userID, currentSessionID)
	return err
}

func (db *Database) UpdateSessionActivity(ctx context.Context, sessionID uuid.UUID) error {
	query := `UPDATE sessions SET last_active_at = NOW() WHERE id = $1`
	_, err := db.Pool.Exec(ctx, query, sessionID)
	return err
}

// ----------------- Prekey Bundles & OTPKs -----------------

func (db *Database) UpsertPrekeyBundle(ctx context.Context, b *models.PrekeyBundle) error {
	query := `
		INSERT INTO prekey_bundles (user_id, registration_id, identity_key, signed_prekey_id, signed_prekey, signed_prekey_signature, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id) DO UPDATE SET
			registration_id = EXCLUDED.registration_id,
			identity_key = EXCLUDED.identity_key,
			signed_prekey_id = EXCLUDED.signed_prekey_id,
			signed_prekey = EXCLUDED.signed_prekey,
			signed_prekey_signature = EXCLUDED.signed_prekey_signature,
			updated_at = EXCLUDED.updated_at
	`
	_, err := db.Pool.Exec(ctx, query, b.UserID, b.RegistrationID, b.IdentityKey, b.SignedPrekeyID, b.SignedPrekey, b.SignedPrekeySignature, b.UpdatedAt)
	return err
}

func (db *Database) GetPrekeyBundleByUserID(ctx context.Context, userID uuid.UUID) (*models.PrekeyBundle, error) {
	query := `
		SELECT user_id, registration_id, identity_key, signed_prekey_id, signed_prekey, signed_prekey_signature, updated_at
		FROM prekey_bundles
		WHERE user_id = $1
		LIMIT 1
	`
	var b models.PrekeyBundle
	err := db.Pool.QueryRow(ctx, query, userID).Scan(
		&b.UserID, &b.RegistrationID, &b.IdentityKey, &b.SignedPrekeyID, &b.SignedPrekey, &b.SignedPrekeySignature, &b.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (db *Database) InsertOneTimePrekeys(ctx context.Context, userID uuid.UUID, keys []models.OneTimePrekey) error {
	if len(keys) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	query := `INSERT INTO one_time_prekeys (id, user_id, key_id, public_key, used, created_at) VALUES ($1, $2, $3, $4, $5, $6)`
	now := time.Now()

	for _, k := range keys {
		batch.Queue(query, uuid.New(), userID, k.KeyID, k.PublicKey, false, now)
	}

	br := db.Pool.SendBatch(ctx, batch)
	defer br.Close()

	for range keys {
		if _, err := br.Exec(); err != nil {
			return err
		}
	}
	return nil
}

func (db *Database) PopOneTimePrekey(ctx context.Context, userID uuid.UUID) (*models.OneTimePrekey, error) {
	query := `
		UPDATE one_time_prekeys
		SET used = TRUE
		WHERE id = (
			SELECT id FROM one_time_prekeys
			WHERE user_id = $1 AND used = FALSE
			ORDER BY key_id ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING id, user_id, key_id, public_key, used, created_at
	`
	var k models.OneTimePrekey
	err := db.Pool.QueryRow(ctx, query, userID).Scan(&k.ID, &k.UserID, &k.KeyID, &k.PublicKey, &k.Used, &k.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // OTPKs exhausted for recipient
		}
		return nil, err
	}
	return &k, nil
}

func (db *Database) GetRemainingOPKCount(ctx context.Context, userID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM one_time_prekeys WHERE user_id = $1 AND used = FALSE`
	var count int
	err := db.Pool.QueryRow(ctx, query, userID).Scan(&count)
	return count, err
}

// ----------------- WebAuthn Credentials -----------------

func (db *Database) SaveWebAuthnCredential(ctx context.Context, c *models.WebAuthnCredential) error {
	query := `
		INSERT INTO webauthn_credentials (id, user_id, credential_id, public_key, attestation_type, aaguid, sign_count, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := db.Pool.Exec(ctx, query, c.ID, c.UserID, c.CredentialID, c.PublicKey, c.AttestationType, c.AAGUID, c.SignCount, c.CreatedAt)
	return err
}

func (db *Database) GetWebAuthnCredentialsByUserID(ctx context.Context, userID uuid.UUID) ([]models.WebAuthnCredential, error) {
	query := `
		SELECT id, user_id, credential_id, public_key, attestation_type, aaguid, sign_count, created_at, last_used_at
		FROM webauthn_credentials
		WHERE user_id = $1
	`
	rows, err := db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var creds []models.WebAuthnCredential
	for rows.Next() {
		var c models.WebAuthnCredential
		if err := rows.Scan(&c.ID, &c.UserID, &c.CredentialID, &c.PublicKey, &c.AttestationType, &c.AAGUID, &c.SignCount, &c.CreatedAt, &c.LastUsedAt); err != nil {
			return nil, err
		}
		creds = append(creds, c)
	}
	return creds, nil
}
