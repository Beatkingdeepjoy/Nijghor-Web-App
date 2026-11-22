package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID    uuid.UUID `json:"user_id"`
	Username  string    `json:"username"`
	SessionID uuid.UUID `json:"session_id,omitempty"`
	jwt.RegisteredClaims
}

type EmailTokenClaims struct {
	EmailHash string `json:"email_hash"`
	jwt.RegisteredClaims
}

type JWTManager struct {
	AccessSecret  []byte
	RefreshSecret []byte
}

func NewJWTManager(accessSecret, refreshSecret string) *JWTManager {
	return &JWTManager{
		AccessSecret:  []byte(accessSecret),
		RefreshSecret: []byte(refreshSecret),
	}
}

// Generate Access Token (Short-lived, e.g., 15 minutes)
func (m *JWTManager) GenerateAccessToken(userID uuid.UUID, username string) (string, int64, error) {
	expiresAt := time.Now().Add(15 * time.Minute)
	claims := &Claims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "nijghor-server",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(m.AccessSecret)
	return tokenString, expiresAt.Unix(), err
}

// Generate Refresh Token (Longer-lived, 30 days)
func (m *JWTManager) GenerateRefreshToken(userID, sessionID uuid.UUID) (string, error) {
	expiresAt := time.Now().Add(30 * 24 * time.Hour)
	claims := &Claims{
		UserID:    userID,
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "nijghor-server",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.RefreshSecret)
}

// Validate Access Token
func (m *JWTManager) ValidateAccessToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return m.AccessSecret, nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid access token claims")
	}

	return claims, nil
}

// Validate Refresh Token
func (m *JWTManager) ValidateRefreshToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return m.RefreshSecret, nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid refresh token claims")
	}

	return claims, nil
}

// Generate Short-lived Email Verification Token
func (m *JWTManager) GenerateEmailVerificationToken(emailHash string) (string, error) {
	expiresAt := time.Now().Add(15 * time.Minute)
	claims := &EmailTokenClaims{
		EmailHash: emailHash,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "nijghor-server",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.AccessSecret)
}

// Validate Email Verification Token
func (m *JWTManager) ValidateEmailVerificationToken(tokenString string) (string, error) {
	token, err := jwt.ParseWithClaims(tokenString, &EmailTokenClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return m.AccessSecret, nil
	})

	if err != nil {
		return "", err
	}

	claims, ok := token.Claims.(*EmailTokenClaims)
	if !ok || !token.Valid {
		return "", errors.New("invalid email verification token claims")
	}

	return claims.EmailHash, nil
}

// Hash Refresh Token for Secure Database Storage
func HashRefreshToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// Hash Email for Zero-Knowledge Lookup
func HashEmail(email string) string {
	sum := sha256.Sum256([]byte(email))
	return hex.EncodeToString(sum[:])
}
