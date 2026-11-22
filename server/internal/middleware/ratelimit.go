package middleware

import (
	"net/http"
	"strings"
	"time"

	"nijghor/server/internal/storage"
)

type RateLimiter struct {
	redis *storage.RedisClient
}

func NewRateLimiter(redis *storage.RedisClient) *RateLimiter {
	return &RateLimiter{redis: redis}
}

func (rl *RateLimiter) LimitByIP(maxRequests int64, window time.Duration, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := getIP(r)
		allowed, err := rl.redis.AllowRateLimit(r.Context(), "ip:"+ip, maxRequests, window)
		if err == nil && !allowed {
			http.Error(w, `{"error":"rate limit exceeded. please slow down"}`, http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
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
