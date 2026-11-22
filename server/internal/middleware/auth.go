package middleware

import (
	"context"
	"net/http"
	"strings"

	"nijghor/server/internal/auth"
)

type contextKey string

const claimsContextKey contextKey = "user_claims"

type AuthMiddleware struct {
	jwtManager *auth.JWTManager
}

func NewAuthMiddleware(jwtMgr *auth.JWTManager) *AuthMiddleware {
	return &AuthMiddleware{jwtManager: jwtMgr}
}

func (m *AuthMiddleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"authorization header missing"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			http.Error(w, `{"error":"invalid authorization header format"}`, http.StatusUnauthorized)
			return
		}

		claims, err := m.jwtManager.ValidateAccessToken(parts[1])
		if err != nil {
			http.Error(w, `{"error":"invalid or expired access token"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), claimsContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetClaims(ctx context.Context) *auth.Claims {
	if val := ctx.Value(claimsContextKey); val != nil {
		if claims, ok := val.(*auth.Claims); ok {
			return claims
		}
	}
	return nil
}
