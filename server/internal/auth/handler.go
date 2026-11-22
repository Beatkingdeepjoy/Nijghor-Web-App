package auth

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"nijghor/server/internal/middleware"
)

type Handler struct {
	service *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{service: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux, authMiddleware *middleware.AuthMiddleware) {
	mux.HandleFunc("POST /api/auth/email/request-code", h.handleRequestEmailCode)
	mux.HandleFunc("POST /api/auth/email/verify-code", h.handleVerifyEmailCode)
	mux.HandleFunc("GET /api/auth/username/check", h.handleCheckUsername)
	mux.HandleFunc("POST /api/auth/register", h.handleRegister)
	mux.HandleFunc("POST /api/auth/login/password", h.handleLoginPassword)
	mux.HandleFunc("POST /api/auth/login/email", h.handleLoginEmail)
	mux.HandleFunc("POST /api/auth/refresh", h.handleRefresh)

	// Protected Session Management Routes
	mux.Handle("GET /api/auth/sessions", authMiddleware.RequireAuth(http.HandlerFunc(h.handleGetSessions)))
	mux.Handle("DELETE /api/auth/sessions/{id}", authMiddleware.RequireAuth(http.HandlerFunc(h.handleRevokeSession)))
	mux.Handle("DELETE /api/auth/sessions/other", authMiddleware.RequireAuth(http.HandlerFunc(h.handleRevokeOtherSessions)))
	mux.Handle("DELETE /api/auth/account", authMiddleware.RequireAuth(http.HandlerFunc(h.handleDeleteAccount)))
}

type requestEmailCodeReq struct {
	Email    string `json:"email"`
	Honeypot string `json:"honeypot"`
}

func (h *Handler) handleRequestEmailCode(w http.ResponseWriter, r *http.Request) {
	var req requestEmailCodeReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request format"}`, http.StatusBadRequest)
		return
	}

	clientIP := getIP(r)
	if err := h.service.RequestEmailCode(r.Context(), req.Email, req.Honeypot, clientIP); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":            true,
		"expires_in_seconds": 600,
		"message":            "Verification code sent to your email",
	})
}

type verifyEmailCodeReq struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

func (h *Handler) handleVerifyEmailCode(w http.ResponseWriter, r *http.Request) {
	var req verifyEmailCodeReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request format"}`, http.StatusBadRequest)
		return
	}

	res, err := h.service.VerifyEmailCode(r.Context(), req.Email, req.Code)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":                  true,
		"email_verification_token": res.EmailVerificationToken,
		"is_existing_user":         res.IsExistingUser,
		"existing_username":        res.ExistingUsername,
	})
}

func (h *Handler) handleCheckUsername(w http.ResponseWriter, r *http.Request) {
	username := r.URL.Query().Get("username")
	available, sanitized, errMsg := h.service.CheckUsername(r.Context(), username)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"is_available":       available,
		"sanitized_username": sanitized,
		"error_message":      errMsg,
	})
}

type registerReq struct {
	Username               string `json:"username"`
	EmailVerificationToken string `json:"email_verification_token"`
	AuthType               string `json:"auth_type"` // "PASSWORD" or "WEBAUTHN"
	Password               string `json:"password"`
	DeviceHint             string `json:"device_hint"`
}

func (h *Handler) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request format"}`, http.StatusBadRequest)
		return
	}

	deviceHint := req.DeviceHint
	if deviceHint == "" {
		deviceHint = r.UserAgent()
	}

	res, err := h.service.Register(r.Context(), RegisterInput{
		Username:               req.Username,
		EmailVerificationToken: req.EmailVerificationToken,
		AuthType:               req.AuthType,
		Password:               req.Password,
		DeviceHint:             deviceHint,
		IPAddress:              getIP(r),
	})
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"success":       true,
		"user_id":       res.UserID.String(),
		"username":      res.Username,
		"access_token":  res.AccessToken,
		"refresh_token": res.RefreshToken,
		"expires_at":    res.ExpiresAt,
	})
}

type loginPasswordReq struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	DeviceHint string `json:"device_hint"`
}

func (h *Handler) handleLoginPassword(w http.ResponseWriter, r *http.Request) {
	var req loginPasswordReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request format"}`, http.StatusBadRequest)
		return
	}

	deviceHint := req.DeviceHint
	if deviceHint == "" {
		deviceHint = r.UserAgent()
	}

	res, err := h.service.LoginPassword(r.Context(), req.Username, req.Password, deviceHint, getIP(r))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":       true,
		"user_id":       res.UserID.String(),
		"username":      res.Username,
		"access_token":  res.AccessToken,
		"refresh_token": res.RefreshToken,
		"expires_at":    res.ExpiresAt,
	})
}

type loginEmailReq struct {
	EmailVerificationToken string `json:"email_verification_token"`
	DeviceHint             string `json:"device_hint"`
}

func (h *Handler) handleLoginEmail(w http.ResponseWriter, r *http.Request) {
	var req loginEmailReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request format"}`, http.StatusBadRequest)
		return
	}

	deviceHint := req.DeviceHint
	if deviceHint == "" {
		deviceHint = r.UserAgent()
	}

	res, err := h.service.LoginWithEmailToken(r.Context(), req.EmailVerificationToken, deviceHint, getIP(r))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":       true,
		"user_id":       res.UserID.String(),
		"username":      res.Username,
		"access_token":  res.AccessToken,
		"refresh_token": res.RefreshToken,
		"expires_at":    res.ExpiresAt,
	})
}

type refreshReq struct {
	RefreshToken string `json:"refresh_token"`
}

func (h *Handler) handleRefresh(w http.ResponseWriter, r *http.Request) {
	var req refreshReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request format"}`, http.StatusBadRequest)
		return
	}

	res, err := h.service.RefreshSession(r.Context(), req.RefreshToken, getIP(r))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":       true,
		"user_id":       res.UserID.String(),
		"username":      res.Username,
		"access_token":  res.AccessToken,
		"refresh_token": res.RefreshToken,
		"expires_at":    res.ExpiresAt,
	})
}

func (h *Handler) handleGetSessions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	sessions, err := h.service.GetSessions(r.Context(), claims.UserID, claims.SessionID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"sessions": sessions,
	})
}

func (h *Handler) handleRevokeSession(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	sessionIDStr := r.PathValue("id")
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid session id"}`, http.StatusBadRequest)
		return
	}

	if err := h.service.RevokeSession(r.Context(), claims.UserID, sessionID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

func (h *Handler) handleRevokeOtherSessions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	if err := h.service.RevokeOtherSessions(r.Context(), claims.UserID, claims.SessionID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

func (h *Handler) handleDeleteAccount(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	if err := h.service.DeleteAccount(r.Context(), claims.UserID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Account and all associated public keys permanently deleted",
	})
}

// ----------------- Helpers -----------------

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func getIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
		return strings.TrimSpace(xrip)
	}
	return r.RemoteAddr
}
