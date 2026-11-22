package auth_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"nijghor/server/internal/auth"
)

func TestJWTManager(t *testing.T) {
	jwtMgr := auth.NewJWTManager("test_access_secret_32_bytes_long!!", "test_refresh_secret_32_bytes_long!")

	userID := uuid.New()
	username := "rahul"

	// 1. Generate & Validate Access Token
	token, exp, err := jwtMgr.GenerateAccessToken(userID, username)
	if err != nil {
		t.Fatalf("GenerateAccessToken failed: %v", err)
	}
	if token == "" || exp <= time.Now().Unix() {
		t.Fatalf("Invalid token or expiry: %s, %d", token, exp)
	}

	claims, err := jwtMgr.ValidateAccessToken(token)
	if err != nil {
		t.Fatalf("ValidateAccessToken failed: %v", err)
	}
	if claims.UserID != userID || claims.Username != username {
		t.Fatalf("Claims mismatch: got (%s, %s), want (%s, %s)", claims.UserID, claims.Username, userID, username)
	}

	// 2. Generate & Validate Refresh Token
	sessionID := uuid.New()
	refToken, err := jwtMgr.GenerateRefreshToken(userID, sessionID)
	if err != nil {
		t.Fatalf("GenerateRefreshToken failed: %v", err)
	}

	refClaims, err := jwtMgr.ValidateRefreshToken(refToken)
	if err != nil {
		t.Fatalf("ValidateRefreshToken failed: %v", err)
	}
	if refClaims.UserID != userID || refClaims.SessionID != sessionID {
		t.Fatalf("Refresh claims mismatch")
	}

	// 3. Email verification token
	emailHash := auth.HashEmail("rahul@example.com")
	emailToken, err := jwtMgr.GenerateEmailVerificationToken(emailHash)
	if err != nil {
		t.Fatalf("GenerateEmailVerificationToken failed: %v", err)
	}

	verifiedHash, err := jwtMgr.ValidateEmailVerificationToken(emailToken)
	if err != nil {
		t.Fatalf("ValidateEmailVerificationToken failed: %v", err)
	}
	if verifiedHash != emailHash {
		t.Fatalf("Email hash mismatch: got %s, want %s", verifiedHash, emailHash)
	}
}

func TestEmailHashing(t *testing.T) {
	h1 := auth.HashEmail("test@example.com")
	h2 := auth.HashEmail("test@example.com")
	h3 := auth.HashEmail("other@example.com")

	if h1 != h2 {
		t.Errorf("Identical emails produced different hashes")
	}
	if h1 == h3 {
		t.Errorf("Different emails produced identical hashes")
	}
	if len(h1) != 64 {
		t.Errorf("Expected 64-char hex SHA256, got %d", len(h1))
	}
}
