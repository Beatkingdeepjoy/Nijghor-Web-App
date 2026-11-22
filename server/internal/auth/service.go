package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"strings"
	"time"

	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"nijghor/server/internal/config"
	"nijghor/server/internal/email"
	"nijghor/server/internal/models"
	"nijghor/server/internal/storage"
)

var (
	usernameRegex = regexp.MustCompile(`^[a-z0-9_]{3,30}$`)
	reservedUsernames = map[string]bool{
		"admin": true, "administrator": true, "system": true, "support": true,
		"nijghor": true, "official": true, "root": true, "help": true, "security": true,
	}
)

type Service struct {
	cfg        *config.Config
	db         *storage.Database
	redis      *storage.RedisClient
	mailer     email.Mailer
	jwtManager *JWTManager
	webAuthn   *webauthn.WebAuthn
}

func NewService(cfg *config.Config, db *storage.Database, redis *storage.RedisClient, mailer email.Mailer, jwtMgr *JWTManager) (*Service, error) {
	wConfig := &webauthn.Config{
		RPDisplayName: cfg.WebAuthnRPDisplayName,
		RPID:          cfg.WebAuthnRPID,
		RPOrigins:     []string{cfg.WebAuthnRPOrigin, "http://localhost:5173", "https://localhost"},
	}

	wa, err := webauthn.New(wConfig)
	if err != nil {
		return nil, fmt.Errorf("init webauthn: %w", err)
	}

	return &Service{
		cfg:        cfg,
		db:         db,
		redis:      redis,
		mailer:     mailer,
		jwtManager: jwtMgr,
		webAuthn:   wa,
	}, nil
}

// ----------------- Email Verification Flow -----------------

func (s *Service) RequestEmailCode(ctx context.Context, rawEmail, honeypot, clientIP string) error {
	if honeypot != "" {
		// Silent drop for spambots
		return nil
	}

	emailClean := strings.ToLower(strings.TrimSpace(rawEmail))
	if !strings.Contains(emailClean, "@") || len(emailClean) < 5 {
		return errors.New("invalid email address")
	}

	// Rate limiting: 5 requests per 10 minutes per email and IP
	allowed, err := s.redis.AllowRateLimit(ctx, "email_code:"+emailClean, 5, 10*time.Minute)
	if err != nil || !allowed {
		return errors.New("too many verification requests. please wait 10 minutes")
	}

	// Generate 6-digit numeric verification code
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return err
	}
	code := fmt.Sprintf("%06d", n.Int64()+100000)

	emailHash := HashEmail(emailClean)
	codeHash := HashEmail(code)

	// Invalidate previous active codes for this email
	_ = s.db.DeleteEmailVerifications(ctx, emailHash)

	ev := &models.EmailVerification{
		ID:        uuid.New(),
		EmailHash: emailHash,
		CodeHash:  codeHash,
		Attempts:  0,
		ExpiresAt: time.Now().Add(10 * time.Minute),
		CreatedAt: time.Now(),
	}

	if err := s.db.SaveEmailVerification(ctx, ev); err != nil {
		return fmt.Errorf("save verification code: %w", err)
	}

	// Dispatch email asynchronously
	go func() {
		_ = s.mailer.SendVerificationCode(emailClean, code)
	}()

	return nil
}

type VerifyEmailResult struct {
	EmailVerificationToken string
	IsExistingUser         bool
	ExistingUsername       string
	ExistingUserID         uuid.UUID
}

func (s *Service) VerifyEmailCode(ctx context.Context, rawEmail, code string) (*VerifyEmailResult, error) {
	emailClean := strings.ToLower(strings.TrimSpace(rawEmail))
	emailHash := HashEmail(emailClean)

	ev, err := s.db.GetLatestEmailVerification(ctx, emailHash)
	if err != nil {
		return nil, errors.New("verification code expired or not found")
	}

	if ev.Attempts >= 5 {
		_ = s.db.DeleteEmailVerifications(ctx, emailHash)
		return nil, errors.New("too many failed attempts. please request a new code")
	}

	expectedCodeHash := HashEmail(strings.TrimSpace(code))
	if ev.CodeHash != expectedCodeHash {
		_ = s.db.IncrementVerificationAttempts(ctx, ev.ID)
		return nil, errors.New("incorrect verification code")
	}

	// Verification succeeded - consume code
	_ = s.db.DeleteEmailVerifications(ctx, emailHash)

	// Generate short-lived email ownership token (15 min)
	token, err := s.jwtManager.GenerateEmailVerificationToken(emailHash)
	if err != nil {
		return nil, err
	}

	// Check if this email already has an account
	result := &VerifyEmailResult{
		EmailVerificationToken: token,
		IsExistingUser:         false,
	}

	existingUser, err := s.db.GetUserByEmailHash(ctx, emailHash)
	if err == nil && existingUser != nil {
		result.IsExistingUser = true
		result.ExistingUsername = existingUser.Username
		result.ExistingUserID = existingUser.ID
	}

	return result, nil
}

// ----------------- Username Live Check -----------------

func (s *Service) CheckUsername(ctx context.Context, rawUsername string) (bool, string, string) {
	clean := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(rawUsername), "@"))

	if len(clean) < 3 {
		return false, clean, "Username must be at least 3 characters"
	}
	if len(clean) > 30 {
		return false, clean, "Username cannot exceed 30 characters"
	}
	if !usernameRegex.MatchString(clean) {
		return false, clean, "Username may only contain letters, numbers, and underscores"
	}
	if reservedUsernames[clean] {
		return false, clean, "This username is reserved"
	}

	existing, err := s.db.GetUserByUsername(ctx, clean)
	if err == nil && existing != nil {
		return false, clean, "Username is already taken"
	}

	return true, clean, ""
}

// ----------------- Account Registration & Login -----------------

type RegisterInput struct {
	Username               string
	EmailVerificationToken string
	AuthType               string // "PASSWORD" or "WEBAUTHN"
	Password               string // Pre-hashed password or plaintext
	DeviceHint             string
	IPAddress              string
}

type AuthResult struct {
	UserID       uuid.UUID
	Username     string
	AccessToken  string
	RefreshToken string
	ExpiresAt    int64
	SessionID    uuid.UUID
}

func (s *Service) Register(ctx context.Context, input RegisterInput) (*AuthResult, error) {
	// 1. Verify email token
	emailHash, err := s.jwtManager.ValidateEmailVerificationToken(input.EmailVerificationToken)
	if err != nil {
		return nil, errors.New("invalid or expired email verification token")
	}

	// 2. Validate username
	available, cleanUsername, errMsg := s.CheckUsername(ctx, input.Username)
	if !available {
		return nil, errors.New(errMsg)
	}

	// 3. Ensure email is not already registered
	existing, _ := s.db.GetUserByEmailHash(ctx, emailHash)
	if existing != nil {
		return nil, errors.New("an account with this email already exists")
	}

	// 4. Hash password if password auth
	var passwordHash string
	if input.AuthType == "PASSWORD" {
		if len(input.Password) < 6 {
			return nil, errors.New("password must be at least 6 characters")
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("hash password: %w", err)
		}
		passwordHash = string(hash)
	}

	userID := uuid.New()
	user := &models.User{
		ID:           userID,
		Username:     cleanUsername,
		EmailHash:    emailHash,
		PasswordHash: passwordHash,
		AuthType:     input.AuthType,
		Status:       "ACTIVE",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.db.CreateUser(ctx, user); err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}

	// 5. Create Session & Tokens
	sessionID := uuid.New()
	refreshToken, err := s.jwtManager.GenerateRefreshToken(userID, sessionID)
	if err != nil {
		return nil, err
	}

	session := &models.Session{
		ID:               sessionID,
		UserID:           userID,
		RefreshTokenHash: HashRefreshToken(refreshToken),
		DeviceHint:       input.DeviceHint,
		IPAddress:        input.IPAddress,
		CreatedAt:        time.Now(),
		LastActiveAt:     time.Now(),
		ExpiresAt:        time.Now().Add(30 * 24 * time.Hour),
	}

	if err := s.db.CreateSession(ctx, session); err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}

	accessToken, expiresAt, err := s.jwtManager.GenerateAccessToken(userID, cleanUsername)
	if err != nil {
		return nil, err
	}

	return &AuthResult{
		UserID:       userID,
		Username:     cleanUsername,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
		SessionID:    sessionID,
	}, nil
}

func (s *Service) LoginPassword(ctx context.Context, username, password, deviceHint, ipAddress string) (*AuthResult, error) {
	cleanUsername := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(username), "@"))
	user, err := s.db.GetUserByUsername(ctx, cleanUsername)
	if err != nil || user == nil {
		return nil, errors.New("invalid username or password")
	}

	if user.PasswordHash == "" {
		return nil, errors.New("account is configured with passkey authentication")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid username or password")
	}

	sessionID := uuid.New()
	refreshToken, err := s.jwtManager.GenerateRefreshToken(user.ID, sessionID)
	if err != nil {
		return nil, err
	}

	session := &models.Session{
		ID:               sessionID,
		UserID:           user.ID,
		RefreshTokenHash: HashRefreshToken(refreshToken),
		DeviceHint:       deviceHint,
		IPAddress:        ipAddress,
		CreatedAt:        time.Now(),
		LastActiveAt:     time.Now(),
		ExpiresAt:        time.Now().Add(30 * 24 * time.Hour),
	}

	if err := s.db.CreateSession(ctx, session); err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}

	accessToken, expiresAt, err := s.jwtManager.GenerateAccessToken(user.ID, user.Username)
	if err != nil {
		return nil, err
	}

	return &AuthResult{
		UserID:       user.ID,
		Username:     user.Username,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
		SessionID:    sessionID,
	}, nil
}

// Login via verified email code (e.g. account recovery / new browser)
func (s *Service) LoginWithEmailToken(ctx context.Context, emailToken, deviceHint, ipAddress string) (*AuthResult, error) {
	emailHash, err := s.jwtManager.ValidateEmailVerificationToken(emailToken)
	if err != nil {
		return nil, errors.New("invalid or expired email verification token")
	}

	user, err := s.db.GetUserByEmailHash(ctx, emailHash)
	if err != nil || user == nil {
		return nil, errors.New("no user found for this verified email")
	}

	sessionID := uuid.New()
	refreshToken, err := s.jwtManager.GenerateRefreshToken(user.ID, sessionID)
	if err != nil {
		return nil, err
	}

	session := &models.Session{
		ID:               sessionID,
		UserID:           user.ID,
		RefreshTokenHash: HashRefreshToken(refreshToken),
		DeviceHint:       deviceHint,
		IPAddress:        ipAddress,
		CreatedAt:        time.Now(),
		LastActiveAt:     time.Now(),
		ExpiresAt:        time.Now().Add(30 * 24 * time.Hour),
	}

	if err := s.db.CreateSession(ctx, session); err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}

	accessToken, expiresAt, err := s.jwtManager.GenerateAccessToken(user.ID, user.Username)
	if err != nil {
		return nil, err
	}

	return &AuthResult{
		UserID:       user.ID,
		Username:     user.Username,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
		SessionID:    sessionID,
	}, nil
}

func (s *Service) RefreshSession(ctx context.Context, rawRefreshToken, ipAddress string) (*AuthResult, error) {
	claims, err := s.jwtManager.ValidateRefreshToken(rawRefreshToken)
	if err != nil {
		return nil, errors.New("invalid or expired refresh token")
	}

	session, err := s.db.GetSessionByID(ctx, claims.SessionID)
	if err != nil || session == nil || session.RevokedAt != nil || session.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("session has been revoked or expired")
	}

	if session.RefreshTokenHash != HashRefreshToken(rawRefreshToken) {
		return nil, errors.New("token mismatch")
	}

	user, err := s.db.GetUserByID(ctx, claims.UserID)
	if err != nil || user == nil {
		return nil, errors.New("user not found")
	}

	// Rotate refresh token
	newRefreshToken, err := s.jwtManager.GenerateRefreshToken(user.ID, session.ID)
	if err != nil {
		return nil, err
	}

	session.RefreshTokenHash = HashRefreshToken(newRefreshToken)
	session.LastActiveAt = time.Now()
	_ = s.db.UpdateSessionActivity(ctx, session.ID)

	accessToken, expiresAt, err := s.jwtManager.GenerateAccessToken(user.ID, user.Username)
	if err != nil {
		return nil, err
	}

	return &AuthResult{
		UserID:       user.ID,
		Username:     user.Username,
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		ExpiresAt:    expiresAt,
		SessionID:    session.ID,
	}, nil
}

func (s *Service) RevokeSession(ctx context.Context, userID, sessionID uuid.UUID) error {
	return s.db.RevokeSession(ctx, sessionID, userID)
}

func (s *Service) RevokeOtherSessions(ctx context.Context, userID, currentSessionID uuid.UUID) error {
	return s.db.RevokeOtherSessions(ctx, userID, currentSessionID)
}

func (s *Service) GetSessions(ctx context.Context, userID, currentSessionID uuid.UUID) ([]models.Session, error) {
	return s.db.GetSessionsByUserID(ctx, userID, currentSessionID)
}

func (s *Service) DeleteAccount(ctx context.Context, userID uuid.UUID) error {
	return s.db.DeleteUser(ctx, userID)
}

func (s *Service) LookupUser(ctx context.Context, username string) (*models.User, error) {
	clean := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(username), "@"))
	return s.db.GetUserByUsername(ctx, clean)
}

