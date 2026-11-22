package push

import (
	"encoding/json"
	"log"
	"net/http"

	"nijghor/server/internal/config"
	"nijghor/server/internal/middleware"
	"nijghor/server/internal/storage"
)

type Subscription struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

type Handler struct {
	cfg   *config.Config
	redis *storage.RedisClient
}

func NewHandler(cfg *config.Config, redis *storage.RedisClient) *Handler {
	return &Handler{cfg: cfg, redis: redis}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux, authMiddleware *middleware.AuthMiddleware) {
	mux.Handle("POST /api/push/subscribe", authMiddleware.RequireAuth(http.HandlerFunc(h.handleSubscribe)))
	mux.HandleFunc("GET /api/push/vapid-key", h.handleGetVAPIDKey)
}

func (h *Handler) handleSubscribe(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetClaims(r.Context())
	if claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var sub Subscription
	if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
		http.Error(w, `{"error":"invalid subscription format"}`, http.StatusBadRequest)
		return
	}

	// Save subscription in Redis under user key
	if h.redis != nil {
		data, _ := json.Marshal(sub)
		key := "push:sub:" + claims.UserID.String()
		_ = h.redis.Client.Set(r.Context(), key, data, 0).Err()
	}

	log.Printf("[PUSH] Saved VAPID subscription for user @%s", claims.Username)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"success":true}`))
}

func (h *Handler) handleGetVAPIDKey(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"public_key":"` + h.cfg.VAPIDPublicKey + `"}`))
}
