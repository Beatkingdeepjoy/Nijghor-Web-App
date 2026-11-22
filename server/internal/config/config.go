package config

import (
	"os"
	"strconv"
)

type Config struct {
	Environment        string
	Port               string
	AppBaseURL         string
	DatabaseURL        string
	RedisURL           string
	MinIOEndpoint      string
	MinIOAccessKey     string
	MinIOSecretKey     string
	MinIOBucket        string
	MinIOUseSSL        bool
	JWTAccessSecret    string
	JWTRefreshSecret   string
	VAPIDPublicKey     string
	VAPIDPrivateKey    string
	VAPIDSubject       string
	EmailProvider      string // "mock", "smtp", "resend"
	ResendAPIKey       string
	SMTPHost           string
	SMTPPort           int
	SMTPUser           string
	SMTPPass           string
	SMTPFrom           string
	WebAuthnRPID       string
	WebAuthnRPOrigin   string
	WebAuthnRPDisplayName string
}

func Load() *Config {
	port := getEnv("PORT", "8080")
	smtpPort, _ := strconv.Atoi(getEnv("SMTP_PORT", "1025"))
	minioSSL, _ := strconv.ParseBool(getEnv("MINIO_USE_SSL", "false"))

	return &Config{
		Environment:        getEnv("ENVIRONMENT", "development"),
		Port:               port,
		AppBaseURL:         getEnv("APP_BASE_URL", "http://localhost:5173"),
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://nijghor_user:nijghor_secret_pwd@localhost:5432/nijghor_db?sslmode=disable"),
		RedisURL:           getEnv("REDIS_URL", "redis://:nijghor_redis_pwd@localhost:6379/0"),
		MinIOEndpoint:      getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinIOAccessKey:     getEnv("MINIO_ACCESS_KEY", "nijghor_minio_admin"),
		MinIOSecretKey:     getEnv("MINIO_SECRET_KEY", "nijghor_minio_secret_pwd"),
		MinIOBucket:        getEnv("MINIO_BUCKET", "nijghor-media"),
		MinIOUseSSL:        minioSSL,
		JWTAccessSecret:    getEnv("JWT_ACCESS_SECRET", "nijghor_super_secure_jwt_access_secret_change_in_prod_32b!"),
		JWTRefreshSecret:   getEnv("JWT_REFRESH_SECRET", "nijghor_super_secure_jwt_refresh_secret_change_in_prod_32b!"),
		VAPIDPublicKey:     getEnv("VAPID_PUBLIC_KEY", ""),
		VAPIDPrivateKey:    getEnv("VAPID_PRIVATE_KEY", ""),
		VAPIDSubject:       getEnv("VAPID_SUBJECT", "mailto:admin@nijghor.internal"),
		EmailProvider:      getEnv("EMAIL_PROVIDER", "mock"),
		ResendAPIKey:       getEnv("RESEND_API_KEY", ""),
		SMTPHost:           getEnv("SMTP_HOST", "localhost"),
		SMTPPort:           smtpPort,
		SMTPUser:           getEnv("SMTP_USER", ""),
		SMTPPass:           getEnv("SMTP_PASS", ""),
		SMTPFrom:           getEnv("SMTP_FROM", "Nijghor <no-reply@nijghor.internal>"),
		WebAuthnRPID:       getEnv("WEBAUTHN_RP_ID", "localhost"),
		WebAuthnRPOrigin:   getEnv("WEBAUTHN_RP_ORIGIN", "http://localhost:5173"),
		WebAuthnRPDisplayName: getEnv("WEBAUTHN_RP_DISPLAY_NAME", "Nijghor"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
