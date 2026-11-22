package prekey

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"nijghor/server/internal/models"
	"nijghor/server/internal/storage"
)

type Service struct {
	db *storage.Database
}

func NewService(db *storage.Database) *Service {
	return &Service{db: db}
}

type UploadPrekeysInput struct {
	UserID                uuid.UUID
	RegistrationID        uint32
	IdentityKeyB64        string
	SignedPrekeyID        uint32
	SignedPrekeyB64       string
	SignedPrekeySigB64    string
	OneTimePrekeys        []OneTimePrekeyInput
}

type OneTimePrekeyInput struct {
	KeyID        uint32
	PublicKeyB64 string
}

func (s *Service) UploadPrekeys(ctx context.Context, input UploadPrekeysInput) (int, error) {
	idKeyBytes, err := base64.StdEncoding.DecodeString(input.IdentityKeyB64)
	if err != nil || len(idKeyBytes) == 0 {
		return 0, errors.New("invalid identity_key format")
	}

	spkBytes, err := base64.StdEncoding.DecodeString(input.SignedPrekeyB64)
	if err != nil || len(spkBytes) == 0 {
		return 0, errors.New("invalid signed_prekey format")
	}

	sigBytes, err := base64.StdEncoding.DecodeString(input.SignedPrekeySigB64)
	if err != nil || len(sigBytes) == 0 {
		return 0, errors.New("invalid signed_prekey_signature format")
	}

	bundle := &models.PrekeyBundle{
		UserID:                input.UserID,
		RegistrationID:        input.RegistrationID,
		IdentityKey:           idKeyBytes,
		SignedPrekeyID:        input.SignedPrekeyID,
		SignedPrekey:          spkBytes,
		SignedPrekeySignature: sigBytes,
		UpdatedAt:             time.Now(),
	}

	if err := s.db.UpsertPrekeyBundle(ctx, bundle); err != nil {
		return 0, fmt.Errorf("upsert prekey bundle: %w", err)
	}

	if len(input.OneTimePrekeys) > 0 {
		otpks := make([]models.OneTimePrekey, 0, len(input.OneTimePrekeys))
		for _, raw := range input.OneTimePrekeys {
			pubBytes, err := base64.StdEncoding.DecodeString(raw.PublicKeyB64)
			if err != nil {
				continue
			}
			otpks = append(otpks, models.OneTimePrekey{
				KeyID:     raw.KeyID,
				PublicKey: pubBytes,
			})
		}
		if err := s.db.InsertOneTimePrekeys(ctx, input.UserID, otpks); err != nil {
			return 0, fmt.Errorf("insert one time prekeys: %w", err)
		}
	}

	remaining, _ := s.db.GetRemainingOPKCount(ctx, input.UserID)
	return remaining, nil
}

type PrekeyBundleResult struct {
	UserID                string
	Username              string
	RegistrationID        uint32
	IdentityKeyB64        string
	SignedPrekeyID        uint32
	SignedPrekeyB64       string
	SignedPrekeySigB64    string
	OneTimePrekey         *OneTimePrekeyResult
}

type OneTimePrekeyResult struct {
	KeyID        uint32
	PublicKeyB64 string
}

func (s *Service) FetchPrekeyBundle(ctx context.Context, targetIdentifier string) (*PrekeyBundleResult, error) {
	var targetUser *models.User
	var err error

	if targetUUID, parseErr := uuid.Parse(targetIdentifier); parseErr == nil {
		targetUser, err = s.db.GetUserByID(ctx, targetUUID)
	} else {
		cleanUsername := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(targetIdentifier), "@"))
		targetUser, err = s.db.GetUserByUsername(ctx, cleanUsername)
	}

	if err != nil || targetUser == nil {
		return nil, errors.New("recipient not found")
	}

	bundle, err := s.db.GetPrekeyBundleByUserID(ctx, targetUser.ID)
	if err != nil || bundle == nil {
		return nil, errors.New("recipient has not uploaded public keys yet")
	}

	// Atomically pop one OTPK
	otpk, err := s.db.PopOneTimePrekey(ctx, targetUser.ID)
	var otpkResult *OneTimePrekeyResult
	if err == nil && otpk != nil {
		otpkResult = &OneTimePrekeyResult{
			KeyID:        otpk.KeyID,
			PublicKeyB64: base64.StdEncoding.EncodeToString(otpk.PublicKey),
		}
	}

	return &PrekeyBundleResult{
		UserID:                targetUser.ID.String(),
		Username:              targetUser.Username,
		RegistrationID:        bundle.RegistrationID,
		IdentityKeyB64:        base64.StdEncoding.EncodeToString(bundle.IdentityKey),
		SignedPrekeyID:        bundle.SignedPrekeyID,
		SignedPrekeyB64:       base64.StdEncoding.EncodeToString(bundle.SignedPrekey),
		SignedPrekeySigB64:    base64.StdEncoding.EncodeToString(bundle.SignedPrekeySignature),
		OneTimePrekey:         otpkResult,
	}, nil
}

func (s *Service) GetRemainingOPKCount(ctx context.Context, userID uuid.UUID) (int, error) {
	return s.db.GetRemainingOPKCount(ctx, userID)
}
