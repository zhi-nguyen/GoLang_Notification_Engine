package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	APIPort          string
	WSMaxConnections int
	DatabaseURL      string
	NATSURL          string
	JWTSecret        string
	LogLevel         string
	EmailProvider    string
	SMSProvider      string
	PushProvider     string
}

func Load() (*Config, error) {
	cfg := &Config{
		APIPort:          getEnv("API_PORT", "8080"),
		WSMaxConnections: getEnvInt("WS_MAX_CONNECTIONS", 100000),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://user:pass@localhost:5432/notifications?sslmode=disable"),
		NATSURL:          getEnv("NATS_URL", "nats://localhost:4222"),
		JWTSecret:        getEnv("JWT_SECRET", "change-me-in-production-super-secret-key-32-bytes"),
		LogLevel:         getEnv("LOG_LEVEL", "info"),
		EmailProvider:    getEnv("EMAIL_PROVIDER", "mock"),
		SMSProvider:      getEnv("SMS_PROVIDER", "mock"),
		PushProvider:     getEnv("PUSH_PROVIDER", "mock"),
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return cfg, nil
}

func (c *Config) Validate() error {
	if c.JWTSecret == "" {
		return fmt.Errorf("JWT_SECRET must not be empty")
	}
	if len(c.JWTSecret) < 16 {
		return fmt.Errorf("JWT_SECRET must be at least 16 characters long")
	}
	if c.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL must not be empty")
	}
	if c.NATSURL == "" {
		return fmt.Errorf("NATS_URL must not be empty")
	}
	return nil
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	valStr := getEnv(key, "")
	if valStr == "" {
		return fallback
	}
	val, err := strconv.Atoi(valStr)
	if err != nil {
		return fallback
	}
	return val
}
