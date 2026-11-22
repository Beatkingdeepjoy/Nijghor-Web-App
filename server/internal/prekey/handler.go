package prekey

import (
	"encoding/json"
	"net/http"

	"nijghor/server/internal/middleware"
)

type Handler struct {
	service *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{service: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux, authMiddleware *middleware.AuthMiddleware) {
	// Upload or replenish user's own keys
	mux.Handle("POST /api/keys/upload", authMiddleware.RequireAuth(http.HandlerFunc(h.handleUploadKeys)))

	// Fetch another user's prekey bundle to initiate X3DH
	mux.Handle("GET /api/keys/{username}", authMiddleware.RequireAuth(http.HandlerFunc(h.handleFetchBundle)))

	// Check own remaining one-time prekeys
	mux.Handle("GET /api/keys/count", authMiddleware.RequireAuth(http.HandlerFunc(h.handleGetCount)))
}

type uploadKeysReq struct {
	RegistrationID     uint32               `json:"registration_id"`
	IdentityKey        string               `json:"identity_key"`
	SignedPrekeyID     uint32               `json:"signed_prekey_id"`
	SignedPrekey       string               `json:"signed_prekey"`
	SignedPrekeySig    string               `json:"signed_prekey_signature"`
	OneTimePrekeys     []oneTimePrekeyInput `json:"one_time_prekeys"`
}

type oneTimePrekeyInput struct {
	KeyID     uint32 `json:"key_id"`
	PublicKey string `json:"public_key"`
}

func (h *Handler) handleUploadKeys(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req uploadKeysReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request format"}`, http.StatusBadRequest)
		return
	}

	otpks := make([]OneTimePrekeyInput, 0, len(req.OneTimePrekeys))
	for _, k := range req.OneTimePrekeys {
		otpks = append(otpks, OneTimePrekeyInput{
			KeyID:        k.KeyID,
			PublicKeyB64: k.PublicKey,
		})
	}

	remaining, err := h.service.UploadPrekeys(r.Context(), UploadPrekeysInput{
		UserID:             claims.UserID,
		RegistrationID:     req.RegistrationID,
		IdentityKeyB64:     req.IdentityKey,
		SignedPrekeyID:     req.SignedPrekeyID,
		SignedPrekeyB64:    req.SignedPrekey,
		SignedPrekeySigB64: req.SignedPrekeySig,
		OneTimePrekeys:     otpks,
	})
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":                     true,
		"remaining_one_time_prekeys": remaining,
		"message":                     "Prekey bundle uploaded successfully",
	})
}

func (h *Handler) handleFetchBundle(w http.ResponseWriter, r *http.Request) {
	target := r.PathValue("username")
	if target == "" {
		http.Error(w, `{"error":"missing target username"}`, http.StatusBadRequest)
		return
	}

	bundle, err := h.service.FetchPrekeyBundle(r.Context(), target)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"user_id":                 bundle.UserID,
		"username":                bundle.Username,
		"registration_id":         bundle.RegistrationID,
		"identity_key":            bundle.IdentityKeyB64,
		"signed_prekey_id":        bundle.SignedPrekeyID,
		"signed_prekey":           bundle.SignedPrekeyB64,
		"signed_prekey_signature": bundle.SignedPrekeySigB64,
		"one_time_prekey":         bundle.OneTimePrekey,
	})
}

func (h *Handler) handleGetCount(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	count, err := h.service.GetRemainingOPKCount(r.Context(), claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"remaining_one_time_prekeys": count,
		"needs_replenishment":        count < 10,
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
