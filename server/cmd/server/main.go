package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"nijghor/server/internal/auth"
	"nijghor/server/internal/config"
	"nijghor/server/internal/email"
	"nijghor/server/internal/media"
	"nijghor/server/internal/middleware"
	"nijghor/server/internal/prekey"
	"nijghor/server/internal/push"
	"nijghor/server/internal/relay"
	"nijghor/server/internal/storage"
)

func main() {
	log.Println("[NIJGHOR] Starting Nijghor Server Relay (Go 1.22)...")

	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Initialize PostgreSQL (accounts and prekeys only)
	db, err := storage.NewDatabase(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Printf("[WARN] Postgres connection failed (%v). Continuing with graceful fallback...", err)
	} else {
		defer db.Close()
		log.Println("[NIJGHOR] Connected to PostgreSQL 16")
	}

	// Initialize Redis (presence, ephemeral queue, rate limiting)
	redisClient, err := storage.NewRedisClient(ctx, cfg.RedisURL)
	if err != nil {
		log.Printf("[WARN] Redis connection failed (%v). Continuing with graceful fallback...", err)
	} else {
		defer redisClient.Close()
		log.Println("[NIJGHOR] Connected to Redis 7")
	}

	// Email Mailer (mock, smtp, or resend)
	mailer := email.NewMailer(cfg)

	// JWT Manager
	jwtManager := auth.NewJWTManager(cfg.JWTAccessSecret, cfg.JWTRefreshSecret)

	// Auth & Prekey Services
	authService, err := auth.NewService(cfg, db, redisClient, mailer, jwtManager)
	if err != nil {
		log.Fatalf("[FATAL] Failed to initialize Auth service: %v", err)
	}

	prekeyService := prekey.NewService(db)

	// WebSocket Hub & Relay
	hub := relay.NewHub(redisClient)
	go hub.Run()
	defer hub.Close()

	wsHandler := relay.NewWebSocketHandler(hub, jwtManager)
	mediaHandler := media.NewHandler(cfg)
	pushHandler := push.NewHandler(cfg, redisClient)

	// Handlers & Middlewares
	authHandler := auth.NewHandler(authService)
	prekeyHandler := prekey.NewHandler(prekeyService)
	authMiddleware := middleware.NewAuthMiddleware(jwtManager)

	// Router
	mux := http.NewServeMux()

	// Health Check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"healthy","service":"nijghor-server","version":"1.0.0"}`))
	})

	// WebSocket Relay Endpoint
	mux.HandleFunc("/ws", wsHandler.HandleWebSocket)

	// Register Routes
	authHandler.RegisterRoutes(mux, authMiddleware)
	prekeyHandler.RegisterRoutes(mux, authMiddleware)
	mediaHandler.RegisterRoutes(mux, authMiddleware)
	pushHandler.RegisterRoutes(mux, authMiddleware)

	// Apply Middlewares: SecurityHeaders -> CORS -> RequestLogger -> Mux
	handler := middleware.SecurityHeaders(
		middleware.CORS(cfg.AppBaseURL,
			middleware.RequestLogger(mux),
		),
	)

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful Shutdown Channel
	shutdownChan := make(chan os.Signal, 1)
	signal.Notify(shutdownChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("[NIJGHOR] Server listening on :%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] Server HTTP error: %v", err)
		}
	}()

	<-shutdownChan
	log.Println("[NIJGHOR] Shutting down gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("[ERROR] Server shutdown error: %v", err)
	}
	log.Println("[NIJGHOR] Server stopped.")
}
